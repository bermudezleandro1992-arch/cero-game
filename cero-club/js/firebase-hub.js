/**
 * Cero Club — Firebase Hub Module (Phase 3)
 * Loaded as type="module" in index.html BEFORE hub.js.
 * Handles: auth state, Firestore profile, real-time online count, presence.
 * Exposes: window.FBHub for hub.js to consume.
 */

import { initializeApp }       from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getDatabase, ref, onValue, onDisconnect, set, update, remove } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  writeBatch,
  Timestamp,
  serverTimestamp,
  increment,
  deleteField,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Config ─────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyBQERXx9ZEXRiYrhrWp4v2CX36p2bbn8vU',
  authDomain:        'cero-club.firebaseapp.com',
  projectId:         'cero-club',
  storageBucket:     'cero-club.firebasestorage.app',
  messagingSenderId: '411019935482',
  appId:             '1:411019935482:web:32b4ffd87b83598aa3d343',
  measurementId:     'G-K9VKSL48T4',
  databaseURL:       'https://cero-club-default-rtdb.firebaseio.com',
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const rtdb = getDatabase(app);
const fns  = getFunctions(app, 'us-central1');

// ── State ──────────────────────────────────────────────────────────────────────
let _currentUser   = null;
let _activeGame    = 'hub';
let _presenceTimer = null;
let _rtdbHeartbeat = null;
let _unsubOnline   = null;
let _unsubRtdb     = null;
let _rtdbPresenceRef = null;

const ONLINE_STALE_MS = 3 * 60 * 1000;

// ── Presencia RTDB + onDisconnect (contador real) ─────────────────────────────
async function _setupRtdbPresence(uid, displayName) {
  try {
    const userRef = ref(rtdb, `online/${uid}`);
    _rtdbPresenceRef = userRef;
    const payload = () => ({
      name: displayName || 'Jugador',
      ts:   Date.now(),
      game: _activeGame || 'hub',
    });
    await set(userRef, payload());
    onDisconnect(userRef).remove();

    clearInterval(_rtdbHeartbeat);
    _rtdbHeartbeat = setInterval(() => {
      set(userRef, payload()).catch(() => {});
    }, 30_000);
  } catch (err) {
    console.warn('[FBHub] RTDB presence:', err.message);
  }
}

async function _clearRtdbPresence(uid) {
  try {
    const userRef = _rtdbPresenceRef || ref(rtdb, `online/${uid}`);
    await remove(userRef);
  } catch (_) {}
}

// Firestore presence (respaldo / lastSeen para otras features)
async function _writePresence(uid, displayName) {
  try {
    await setDoc(doc(db, 'presence', uid), {
      displayName,
      lastSeen: serverTimestamp(),
      game:     _activeGame || 'hub',
    }, { merge: true });
  } catch (_) {}
}

async function setActiveGame(game) {
  _activeGame = game || 'hub';
  const uid = _currentUser?.uid;
  if (!uid) return;
  try {
    const userRef = ref(rtdb, `online/${uid}`);
    await update(userRef, { game: _activeGame, ts: Date.now() });
    await updateDoc(doc(db, 'presence', uid), {
      game: _activeGame,
      lastSeen: serverTimestamp(),
    });
  } catch (_) {}
}

function _startPresence(uid, displayName) {
  _setupRtdbPresence(uid, displayName);
  _writePresence(uid, displayName);
  clearInterval(_presenceTimer);
  _presenceTimer = setInterval(() => _writePresence(uid, displayName), 45_000);

  const onLeave = () => { _clearRtdbPresence(uid); };
  window.addEventListener('pagehide', onLeave);
  window.addEventListener('beforeunload', () => {
    clearInterval(_presenceTimer);
    onLeave();
    try {
      updateDoc(doc(db, 'presence', uid), {
        lastSeen: serverTimestamp(),
        game: null,
      });
    } catch (_) {}
  });
}

// ── Real-time online count ─────────────────────────────────────────────────────
// Presence collection has public read rules, so this works even without auth.
function _listenOnlineCount() {
  if (_unsubRtdb) _unsubRtdb();
  if (_unsubOnline) _unsubOnline();

  const onlineRef = ref(rtdb, 'online');
  _unsubRtdb = onValue(
    onlineRef,
    snap => {
      _updateOnlineUI(snap.val() || {});
    },
    err => {
      console.warn('[FBHub] RTDB online listener:', err.message);
      _listenOnlineCountFirestoreFallback();
    },
  );
}

function _listenOnlineCountFirestoreFallback() {
  const cutoff = Timestamp.fromDate(new Date(Date.now() - 90 * 1000));
  const q = query(collection(db, 'presence'), where('lastSeen', '>', cutoff));
  _unsubOnline = onSnapshot(
    q,
    snap => _updateOnlineUI(snap.size),
    () => onSnapshot(collection(db, 'presence'), snap => _updateOnlineUI(snap.size), () => {}),
  );
}

function _countByGame(users) {
  const now = Date.now();
  const alive = Object.entries(users || {})
    .filter(([, u]) => {
      const ts = typeof u?.ts === 'number' ? u.ts : 0;
      return ts && now - ts < ONLINE_STALE_MS;
    });
  return {
    total: alive.length,
    truco: alive.filter(([, u]) => u.game === 'truco').length,
    cero:  alive.filter(([, u]) => u.game === 'cero').length,
    hub:   alive.filter(([, u]) => !u.game || u.game === 'hub').length,
  };
}

function _updateOnlineUI(countOrUsers) {
  const counts = typeof countOrUsers === 'object' && countOrUsers !== null
    ? _countByGame(countOrUsers)
    : { total: Math.max(0, countOrUsers), truco: 0, cero: 0, hub: Math.max(0, countOrUsers) };

  document.querySelectorAll('[data-online-count]').forEach(el => {
    const fmt = el.dataset.onlineFormat || 'full';
    const n = counts.total;
    el.textContent = fmt === 'short' ? String(n) : `${n} en línea`;
  });

  document.querySelectorAll('[data-online-game]').forEach(el => {
    const g = el.dataset.onlineGame;
    const n = g === 'truco' ? counts.truco : g === 'cero' ? counts.cero : 0;
    const fmt = el.dataset.onlineFormat || 'short';
    const lbl = el.dataset.onlineLabel || 'jugando';
    el.textContent = fmt === 'short' ? String(n) : `${n} ${lbl}`;
  });

  const badge = document.getElementById('onlineBadgeCount');
  if (badge) badge.textContent = String(counts.total);
}

// ── Load or create Firestore user profile ──────────────────────────────────────
async function loadProfile(user) {
  const ref  = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    await updateDoc(ref, { lastSeen: serverTimestamp() });
    if (
      data.photoURL &&
      String(data.photoURL).startsWith('https://') &&
      data.avatarStatus !== 'approved' &&
      data.avatarStatus !== 'rejected'
    ) {
      await updateDoc(ref, { avatarStatus: 'approved' });
      data.avatarStatus = 'approved';
    }
    if (!data.friendCode && !user.isAnonymous) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
      await updateDoc(ref, { friendCode: code });
      data.friendCode = code;
    }
    return data;
  } else {
    const profile = {
      displayName:   user.displayName || user.email?.split('@')[0] || 'Invitado',
      email:         user.email   || null,
      photoURL:      user.photoURL || null,
      avatarStatus:  user.photoURL && String(user.photoURL).startsWith('https://') ? 'approved' : 'none',
      anon:          user.isAnonymous,
      coins:         user.isAnonymous ? 0 : 1500,
      xp:            0,
      level:         1,
      gamesPlayed:   0,
      wins:          0,
      wins_truco:    0,
      wins_cero:     0,
      games_truco:   0,
      games_cero:    0,
      rankPoints:    0,
      rankPoints_cero: 0,
      rankPoints_truco: 0,
      createdAt:     serverTimestamp(),
      lastSeen:      serverTimestamp(),
    };
    await setDoc(ref, profile);
    return profile;
  }
}

// ── Refresh coins from Firestore (call from hub anytime) ───────────────────────
async function refreshCoins(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const coins = snap.data().coins ?? 0;
    // Update session cache
    const raw = sessionStorage.getItem('cero_user');
    if (raw) {
      const u = JSON.parse(raw);
      u.coins = coins;
      sessionStorage.setItem('cero_user', JSON.stringify(u));
    }
    // Update UI element
    const el = document.getElementById('coinsAmount');
    if (el) el.textContent = coins.toLocaleString('es-AR');
    return coins;
  } catch (_) { return null; }
}

// ── Save profile changes to Firestore ─────────────────────────────────────────
async function saveProfileToFirestore(uid, data) {
  await updateDoc(doc(db, 'users', uid), {
    ...data,
    lastSeen: serverTimestamp(),
  });
  // Sync sessionStorage
  const raw = sessionStorage.getItem('cero_user');
  if (raw) {
    const u = JSON.parse(raw);
    Object.assign(u, data);
    sessionStorage.setItem('cero_user', JSON.stringify(u));
  }
}

// ── Real Firestore logout ──────────────────────────────────────────────────────
async function fbLogout() {
  clearInterval(_presenceTimer);
  clearInterval(_rtdbHeartbeat);
  if (_unsubOnline) _unsubOnline();
  if (_unsubRtdb) { _unsubRtdb(); _unsubRtdb = null; }
  if (_currentUser) {
    await _clearRtdbPresence(_currentUser.uid);
    try {
      await updateDoc(doc(db, 'presence', _currentUser.uid), {
        lastSeen: serverTimestamp(),
      });
    } catch (_) {}
  }
  await signOut(auth);
  sessionStorage.removeItem('cero_user');
  window.location.href = 'login.html';
}

// ── Auth state observer ────────────────────────────────────────────────────────
function _emitHubReady() {
  window.dispatchEvent(new CustomEvent('fb:hubReady'));
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    _listenOnlineCount();
    const hasSession = !!sessionStorage.getItem('cero_user');
    if (hasSession) {
      console.warn('[FBHub] Sesión local sin Auth — redirigiendo a login');
      sessionStorage.removeItem('cero_user');
      window.dispatchEvent(new CustomEvent('fb:authLost'));
    }
    _emitHubReady();
    return;
  }

  _currentUser = user;

  // Load full profile from Firestore
  let profile = {};
  try {
    profile = await loadProfile(user);
  } catch (err) {
    console.warn('[FBHub] Firestore load error:', err);
  }

  const fbUser = {
    uid:    user.uid,
    name:   profile.displayName || user.displayName || user.email?.split('@')[0] || 'Jugador',
    email:  user.email || profile.email || null,
    photo:  _resolveDisplayPhoto(profile, user),
    avatarStatus: profile.avatarStatus || (user.photoURL ? 'approved' : 'none'),
    identityVerified: !!profile.identityVerified,
    identityName: profile.identityName || null,
    anon:   user.isAnonymous,
    coins:  profile.coins  ?? 0,
    xp:     profile.xp     ?? 0,
    level:  profile.level  ?? 1,
    gamesPlayed: profile.gamesPlayed ?? 0,
    wins:        profile.wins        ?? 0,
    rankPoints:  profile.rankPoints ?? profile.xp ?? 0,
  };

  // Sync sessionStorage with Firestore data
  sessionStorage.setItem('cero_user', JSON.stringify(fbUser));

  // Start presence tracking (RTDB + Firestore)
  _startPresence(user.uid, fbUser.name);
  const pageGame = /\/games\/cero\//.test(location.pathname) ? 'cero'
    : /\/games\/truco\//.test(location.pathname) ? 'truco'
    : 'hub';
  setActiveGame(pageGame);
  _listenOnlineCount();

  // Notify hub.js that Firebase profile is ready
  window._fbUser = fbUser;
  window.dispatchEvent(new CustomEvent('fb:profileReady', { detail: fbUser }));
  _recordSecuritySession().catch(() => {});
  _emitHubReady();
});

function _resolveDisplayPhoto(profile, user) {
  const st = profile.avatarStatus || 'none';
  const url = profile.photoURL || user.photoURL || null;
  if (st === 'rejected') return null;
  if (st === 'approved' && url) return url;
  if (url && String(url).startsWith('https://')) return url;
  return null;
}

async function _recordSecuritySession() {
  if (!_currentUser || _currentUser.isAnonymous) return;
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  let platform = 'desktop';
  if (isIOS) platform = 'ios';
  else if (isAndroid) platform = 'android';
  else if (/Mobile/i.test(ua)) platform = 'mobile';

  let os = 'unknown';
  if (isIOS) os = 'iOS';
  else if (isAndroid) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  const record = httpsCallable(fns, 'recordSecuritySession');
  await record({
    userAgent: ua,
    platform,
    os,
    deviceType: platform,
    screen: `${screen.width}x${screen.height}`,
    language: navigator.language || '',
    isMobile: platform === 'ios' || platform === 'android' || platform === 'mobile',
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: navigator.deviceMemory || 0,
  });
}

// ── Public API (consumed by hub.js) ───────────────────────────────────────────
function _fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const b64 = String(dataUrl).split(',')[1] || '';
      resolve(b64);
    };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

async function _prepareAvatarBase64(file) {
  if (!file) throw new Error('Archivo inválido');
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
  const typeOk = allowed.includes(file.type) || file.type.startsWith('image/');
  if (!typeOk) throw new Error('Elegí una imagen (JPG, PNG, WebP, etc.)');
  if (file.size > 12 * 1024 * 1024) throw new Error('Máximo 12 MB por archivo');

  let quality = 0.88;
  let working = file;
  let b64 = '';
  for (let i = 0; i < 8; i++) {
    working = await _recompressJpeg(working, quality, 480);
    b64 = await _fileToBase64(working);
    if (b64.length <= 850_000) break;
    quality -= 0.1;
  }
  if (!b64 || b64.length > 900_000) {
    throw new Error('La imagen es muy pesada. Probá otra más chica o con menos detalle.');
  }
  return b64;
}

async function uploadAvatarForReview(uid, file) {
  if (!uid || !file) throw new Error('Archivo inválido');

  const imageBase64 = await _prepareAvatarBase64(file);

  await updateDoc(doc(db, 'users', uid), {
    avatarStatus: 'pending',
    avatarRejectReason: deleteField(),
    avatarUploadedAt: serverTimestamp(),
  });

  const moderate = httpsCallable(fns, 'moderateAvatar');
  const { data } = await moderate({ imageBase64 });

  if (data?.status === 'approved' && data.photoURL) {
    if (window._fbUser?.uid === uid) {
      window._fbUser.photo = data.photoURL;
      window._fbUser.avatarStatus = 'approved';
    }
    if (window._lastFbProfile) {
      window._lastFbProfile.photo = data.photoURL;
      window._lastFbProfile.avatarStatus = 'approved';
    }
    return { ok: true, status: 'approved', photoURL: data.photoURL };
  }

  if (data?.status === 'rejected') {
    if (window._fbUser?.uid === uid) window._fbUser.avatarStatus = 'rejected';
    return { ok: false, status: 'rejected' };
  }

  return { ok: false, status: 'pending' };
}

function _recompressJpeg(file, quality, maxPx = 480) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, maxPx / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => blob ? resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' })) : reject(new Error('Error al comprimir')),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Imagen inválida'));
    img.src = url;
  });
}

function watchUserProfile(uid, onChange) {
  return onSnapshot(doc(db, 'users', uid), snap => {
    if (!snap.exists()) return;
    onChange(snap.data());
  });
}

window.FBHub = {
  get db()           { return db; },
  get auth()         { return auth; },
  get currentUser()  { return _currentUser || auth.currentUser; },
  get isReady()      { return true; },
  uploadAvatarForReview,
  watchUserProfile,
  loadProfile,
  refreshCoins,
  saveProfileToFirestore,
  logout:            fbLogout,
  writePresence:     _writePresence,
  setActiveGame,
  // Firestore primitives — used directly in hub.js
  doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  collection, collectionGroup,
  query, where, orderBy, limit,
  onSnapshot, runTransaction, writeBatch,
  serverTimestamp, increment, deleteField, Timestamp,
};

_emitHubReady();
