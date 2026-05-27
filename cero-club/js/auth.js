/**
 * Cero Club — Firebase Auth + Firestore Profile (Phase 3)
 * Google Sign-In · Email/Password · Anonymous
 * On first login: creates user profile in Firestore with 1500 Cero Coins.
 */

import { initializeApp }        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  sendPasswordResetEmail,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Firebase Config ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyBQERXx9ZEXRiYrhrWp4v2CX36p2bbn8vU',
  authDomain:        'cero-club.firebaseapp.com',
  projectId:         'cero-club',
  storageBucket:     'cero-club.firebasestorage.app',
  messagingSenderId: '411019935482',
  appId:             '1:411019935482:web:32b4ffd87b83598aa3d343',
  measurementId:     'G-K9VKSL48T4',
};

const app            = initializeApp(firebaseConfig);
const auth           = getAuth(app);
const db             = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const btnGoogle     = $('btnGoogle');
const btnGoogleReg  = $('btnGoogleReg');
const btnGuest      = $('btnGuest');
const btnForgot     = $('btnForgot');
const formLogin     = $('formLogin');
const formRegister  = $('formRegister');
const authSuccess   = $('authSuccess');
const loginError    = $('loginError');
const registerError = $('registerError');
const tabs          = document.querySelectorAll('.atab');
const panels        = document.querySelectorAll('.auth-panel');

// ── Tab switching ──────────────────────────────────────────────────────────────
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.panel;
    tabs.forEach(t   => t.classList.toggle('active', t === tab));
    panels.forEach(p => p.classList.toggle('active', p.id === target));
    _clearErrors();
  });
});

// ── Password toggle ────────────────────────────────────────────────────────────
document.querySelectorAll('.pass-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.previousElementSibling;
    input.type  = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
  });
});

// ── Auth state listener (handles page refresh while logged in) ─────────────────
onAuthStateChanged(auth, user => {
  if (user) _handleSuccess(user);
});

// ── Google Sign-In ─────────────────────────────────────────────────────────────
[btnGoogle, btnGoogleReg].forEach(btn => {
  btn?.addEventListener('click', async () => {
    _setLoading(btn, true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      _showError(loginError, _friendlyMsg(err.code));
    } finally {
      _setLoading(btn, false);
    }
  });
});

// ── Email Login ────────────────────────────────────────────────────────────────
formLogin?.addEventListener('submit', async e => {
  e.preventDefault();
  const email    = $('loginEmail').value.trim();
  const pass     = $('loginPass').value;
  const remember = $('rememberMe').checked;
  _clearErrors();

  const btn = $('btnLoginEmail');
  _setLoading(btn, true);
  try {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    _showError(loginError, _friendlyMsg(err.code));
  } finally {
    _setLoading(btn, false);
  }
});

// ── Email Register ─────────────────────────────────────────────────────────────
formRegister?.addEventListener('submit', async e => {
  e.preventDefault();
  const name  = $('regName').value.trim();
  const email = $('regEmail').value.trim();
  const pass  = $('regPass').value;
  _clearErrors();

  if (!name) { _showError(registerError, 'Ingresá tu nombre de jugador'); return; }

  const btn = $('btnRegisterEmail');
  _setLoading(btn, true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    // Force re-read so displayName is available in _handleSuccess
    await _handleSuccess({ ...cred.user, displayName: name });
  } catch (err) {
    _showError(registerError, _friendlyMsg(err.code));
  } finally {
    _setLoading(btn, false);
  }
});

// ── Guest / Anonymous ──────────────────────────────────────────────────────────
btnGuest?.addEventListener('click', async () => {
  _setLoading(btnGuest, true);
  try {
    await signInAnonymously(auth);
  } catch (err) {
    _showError(loginError, _friendlyMsg(err.code));
  } finally {
    _setLoading(btnGuest, false);
  }
});

// ── Forgot password ────────────────────────────────────────────────────────────
btnForgot?.addEventListener('click', async () => {
  const email = $('loginEmail').value.trim();
  if (!email) { _showError(loginError, 'Ingresá tu email primero'); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    _showError(loginError, `✔ Email enviado a ${email}`);
    loginError.style.color = '#4ade80';
  } catch (err) {
    _showError(loginError, _friendlyMsg(err.code));
  }
});

// ── Firestore: create or load user profile ─────────────────────────────────────
async function _ensureUserProfile(user) {
  const ref  = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const isAnon = user.isAnonymous;
    const profile = {
      displayName:   user.displayName || user.email?.split('@')[0] || 'Invitado',
      email:         user.email   || null,
      photoURL:      user.photoURL || null,
      anon:          isAnon,
      coins:         isAnon ? 0 : 1500,
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
    return { ...profile, coins: isAnon ? 0 : 1500 };
  } else {
    await updateDoc(ref, { lastSeen: serverTimestamp() });
    return snap.data();
  }
}

// ── Success handler ────────────────────────────────────────────────────────────
let _redirecting = false;
async function _handleSuccess(user) {
  if (_redirecting) return;
  _redirecting = true;

  // Show interim success UI immediately
  const name = user.displayName || user.email?.split('@')[0] || 'Invitado';
  panels.forEach(p => p.classList.remove('active'));
  const tabsEl = document.querySelector('.auth-tabs');
  if (tabsEl) tabsEl.style.display = 'none';
  if (authSuccess) authSuccess.hidden = false;

  const successName   = $('successName');
  const successAvatar = $('successAvatar');
  if (successName)   successName.textContent   = name;
  if (successAvatar) successAvatar.textContent  = name[0].toUpperCase();

  // Load / create Firestore profile
  let profile = {};
  try {
    profile = await _ensureUserProfile(user);
  } catch (err) {
    console.warn('[Cero Auth] Firestore error, continuing with defaults:', err);
    profile = { coins: 0 };
  }

  // Store session
  sessionStorage.setItem('cero_user', JSON.stringify({
    uid:    user.uid,
    name,
    email:  user.email   || null,
    anon:   user.isAnonymous,
    photo:  user.photoURL || null,
    coins:  profile.coins  ?? 0,
    xp:     profile.xp     ?? 0,
    level:  profile.level  ?? 1,
    wins:   profile.wins   ?? 0,
  }));

  setTimeout(() => { window.location.href = '/app/'; }, 1200);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function _setLoading(btn, loading) {
  const text   = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (text)   text.hidden   = loading;
  if (loader) loader.hidden = !loading;
}
function _showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.color = '';
  el.hidden      = false;
}
function _clearErrors() {
  [loginError, registerError].forEach(el => { if (el) el.hidden = true; });
}
function _friendlyMsg(code) {
  const map = {
    'auth/user-not-found':         'No existe una cuenta con ese email',
    'auth/wrong-password':         'Contraseña incorrecta',
    'auth/invalid-credential':     'Email o contraseña incorrectos',
    'auth/email-already-in-use':   'Ese email ya está registrado',
    'auth/weak-password':          'La contraseña debe tener al menos 6 caracteres',
    'auth/invalid-email':          'El email no es válido',
    'auth/too-many-requests':      'Demasiados intentos. Esperá unos minutos',
    'auth/popup-closed-by-user':   'Cerraste la ventana de Google',
    'auth/network-request-failed': 'Sin conexión. Revisá tu internet',
    'auth/operation-not-allowed':  'Este método de login no está habilitado',
  };
  return map[code] || `Error (${code})`;
}
