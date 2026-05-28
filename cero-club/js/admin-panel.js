/**
 * Panel admin Cero Club — gestión de Cero Coins, usuarios y torneos
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBQERXx9ZEXRiYrhrWp4v2CX36p2bbn8vU',
  authDomain: 'cero-club.firebaseapp.com',
  projectId: 'cero-club',
  storageBucket: 'cero-club.firebasestorage.app',
  messagingSenderId: '411019935482',
  appId: '1:411019935482:web:32b4ffd87b83598aa3d343',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const fns = getFunctions(app, 'us-central1');
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const WEBAUTHN_STORE = 'cero_admin_webauthn_v1';
const UNLOCK_KEY = 'cero_admin_unlocked';

const $ = (id) => document.getElementById(id);

let currentUser = null;
let selectedUid = null;
let depositsCache = [];
let selectedDepositId = null;
let waitingRoomsCache = [];
let authBootstrapped = false;
let pendingAuthUser = null;

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || window.matchMedia('(pointer: coarse)').matches;
}

function friendlyAuthError(code) {
  const map = {
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana. Probá de nuevo.',
    'auth/cancelled-popup-request': 'Esperá un momento e intentá otra vez.',
    'auth/user-not-found': 'No existe una cuenta con ese email.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/invalid-credential': 'Email o contraseña incorrectos.',
    'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos.',
    'auth/network-request-failed': 'Sin conexión. Revisá tu internet.',
    'auth/operation-not-allowed': 'Google Sign-In no está habilitado en Firebase.',
  };
  return map[code] || `Error de acceso (${code || 'desconocido'})`;
}

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64ToBuf(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const str = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(str);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function getStoredWebAuthn() {
  try {
    const raw = localStorage.getItem(WEBAUTHN_STORE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredWebAuthn(data) {
  localStorage.setItem(WEBAUTHN_STORE, JSON.stringify(data));
}

async function platformBioAvailable() {
  if (!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function updateBioUi() {
  const btn = $('btnBioAdmin');
  const hint = $('bioHint');
  if (!btn) return;
  const stored = getStoredWebAuthn();
  const canBio = stored?.credentialId;
  btn.hidden = !canBio;
  btn.classList.toggle('hidden', !canBio);
  if (hint) {
    hint.hidden = !canBio;
    hint.classList.toggle('hidden', !canBio);
  }
  if (canBio && stored?.label) {
    $('btnBioLabel').textContent = stored.label;
  }
}

async function registerWebAuthn(user) {
  if (!(await platformBioAvailable())) return;
  const existing = getStoredWebAuthn();
  if (existing?.uid === user.uid && existing?.credentialId) return;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = new TextEncoder().encode(user.uid);
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'CERO Admin', id: location.hostname },
        user: {
          id: userId,
          name: user.email || user.uid,
          displayName: user.displayName || 'Operador CERO',
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    });
    if (!cred?.rawId) return;
    const label = isMobileDevice() ? 'Ingresar con huella / Face ID' : 'Ingresar con biometría';
    setStoredWebAuthn({
      uid: user.uid,
      email: user.email || '',
      credentialId: bufToB64(cred.rawId),
      label,
    });
    updateBioUi();
  } catch (err) {
    console.warn('[admin] WebAuthn register skipped:', err);
  }
}

async function unlockWithBiometric() {
  const stored = getStoredWebAuthn();
  if (!stored?.credentialId) {
    showStatus($('loginStatus'), 'Primero ingresá con Google en este dispositivo.', false);
    return false;
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: location.hostname,
        allowCredentials: [{
          id: b64ToBuf(stored.credentialId),
          type: 'public-key',
          transports: ['internal', 'hybrid'],
        }],
        userVerification: 'required',
        timeout: 60000,
      },
    });

    sessionStorage.setItem(UNLOCK_KEY, String(Date.now()));
    const user = auth.currentUser;
    if (user && user.uid === stored.uid) {
      return ensurePanelAccess(user);
    }
    showStatus($('loginStatus'), 'Sesión vencida. Volvé a entrar con Google.', false);
    await signInGoogle();
    return false;
  } catch (err) {
    showStatus($('loginStatus'), 'No se pudo verificar la huella. Usá Google.', false);
    return false;
  }
}

async function signInGoogle() {
  showStatus($('loginStatus'), 'Conectando con Google…', true);
  try {
    if (isMobileDevice()) {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    const cred = await signInWithPopup(auth, googleProvider);
    await afterAuthSuccess(cred.user);
  } catch (err) {
    if (err?.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    showStatus($('loginStatus'), friendlyAuthError(err?.code), false);
  }
}

async function afterAuthSuccess(user) {
  const ok = await ensurePanelAccess(user);
  if (ok) {
    sessionStorage.setItem(UNLOCK_KEY, String(Date.now()));
    await registerWebAuthn(user);
    showStatus($('panelStatus'), 'Sesión iniciada.', true);
  }
}

async function handleAuthUser(user) {
  if (!user) {
    pendingAuthUser = null;
    sessionStorage.removeItem(UNLOCK_KEY);
    return;
  }

  const stored = getStoredWebAuthn();
  const needsBio = stored?.uid === user.uid && stored?.credentialId;
  const unlocked = sessionStorage.getItem(UNLOCK_KEY);

  if (needsBio && !unlocked) {
    pendingAuthUser = user;
    $('loginSection')?.classList.remove('hidden');
    $('panelSection')?.classList.add('hidden');
    updateBioUi();
    showStatus($('loginStatus'), 'Desbloqueá el panel con huella o Face ID.', true);
    return;
  }

  pendingAuthUser = null;
  await afterAuthSuccess(user);
}

function fmtTs(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('es-AR');
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

async function loadDeposits() {
  const list = $('depositsList');
  try {
    const data = await callFn('adminListDeposits', { status: 'pending', limit: 40 });
    depositsCache = data.deposits || [];
    const pending = data.alerts?.pendingDeposits ?? depositsCache.length;
    $('depositBadge').textContent = pending > 0 ? `(${pending})` : '';
    $('depositAlert').textContent = data.alerts?.lastDepositEmail
      ? `Último: ${data.alerts.lastDepositEmail} · ${fmtTs(data.alerts.lastDepositAt)}`
      : 'Sin depósitos recientes';

    if (!depositsCache.length) {
      list.innerHTML = '<p style="color:#a78bfa;font-size:.85rem">No hay depósitos pendientes.</p>';
      return;
    }

    list.innerHTML = `<table><thead><tr>
      <th>Fecha</th><th>Jugador</th><th>Método</th><th>CN</th><th>IP</th><th></th>
    </tr></thead><tbody>${depositsCache.map((d) => `<tr class="deposit-row" data-id="${d.id}">
      <td>${fmtTs(d.createdAt)}</td>
      <td>${esc(d.displayName)}<br><span style="color:#a78bfa;font-size:.7rem">${esc(d.email)}</span></td>
      <td>${esc(d.methodLabel)}</td>
      <td><b>${d.coinsRequested}</b></td>
      <td style="font-family:monospace;font-size:.7rem">${esc(d.security?.clientIp)}</td>
      <td><button type="button" class="btn-warn btn-open-dep" data-id="${d.id}">Revisar</button></td>
    </tr>`).join('')}</tbody></table>`;

    list.querySelectorAll('.btn-open-dep').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDepositModal(btn.dataset.id);
      });
    });
  } catch (err) {
    list.innerHTML = `<p style="color:#f87171">${esc(err.message)}</p>`;
  }
}

function openDepositModal(id) {
  const d = depositsCache.find((x) => x.id === id);
  if (!d) return;
  selectedDepositId = id;
  $('depositAdminNote').value = '';
  $('depositCoinsOverride').value = '';

  const sec = d.security || {};
  const hist = d.userHistory || {};
  const isPdf = String(d.receiptMime || '').includes('pdf');

  let receiptHtml = '';
  if (d.receiptDataUrl) {
    receiptHtml = isPdf
      ? `<p><a href="${d.receiptDataUrl}" target="_blank" rel="noopener" class="btn-accent" style="display:inline-block;text-decoration:none">📄 Abrir PDF comprobante</a></p>`
      : `<img class="receipt-preview" src="${d.receiptDataUrl}" alt="Comprobante" />`;
  }

  $('depositDetail').innerHTML = `
    <p><strong>${esc(d.displayName)}</strong> · ${esc(d.email)}</p>
    <p style="font-size:.75rem;color:#a78bfa;word-break:break-all">UID: ${esc(d.uid)}</p>
    <p>Solicita <b style="color:#00ef90">${d.coinsRequested} CN</b> · Pagó ~${d.amountPaid} ${esc(d.currency)} · ${esc(d.methodLabel)}</p>
    ${d.payerReference ? `<p>Ref. pagador: ${esc(d.payerReference)}</p>` : ''}
    ${receiptHtml}
    <div class="sec-grid">
      <div class="sec-box"><b>IP depósito</b>${esc(sec.clientIp)}</div>
      <div class="sec-box"><b>IP historial</b>${esc(hist.lastSessionIp)}</div>
      <div class="sec-box"><b>Device ID</b>${esc(sec.deviceId) || '—'}</div>
      <div class="sec-box"><b>Dispositivo</b>${esc(sec.deviceType)} · ${sec.isMobile ? 'Móvil' : 'PC'}</div>
      <div class="sec-box"><b>SO / Plataforma</b>${esc(sec.os)} · ${esc(sec.platform)}</div>
      <div class="sec-box"><b>Pantalla</b>${esc(sec.screen)}</div>
      <div class="sec-box"><b>Idioma / TZ</b>${esc(sec.language)} · ${esc(sec.timezone)}</div>
      <div class="sec-box"><b>Partidas jugadas</b>${hist.totalGamesPlayed ?? 0}</div>
    </div>
    <p style="font-size:.65rem;color:#a78bfa;word-break:break-all">UA: ${esc(sec.userAgent)}</p>
  `;
  $('depositModal').classList.remove('hidden');
}

async function reviewDeposit(action) {
  if (!selectedDepositId) return;
  const coinsRaw = $('depositCoinsOverride').value.trim();
  const payload = {
    depositId: selectedDepositId,
    action,
    adminNote: $('depositAdminNote').value.trim(),
  };
  if (coinsRaw && action === 'approve') payload.coinsToCredit = Number(coinsRaw);

  if (action === 'approve' && !window.confirm('¿Acreditar monedas a este jugador?')) return;
  if (action === 'reject' && !window.confirm('¿Rechazar este depósito?')) return;

  try {
    const r = await callFn('adminReviewDeposit', payload);
    showStatus($('panelStatus'),
      action === 'approve'
        ? `✓ Acreditados ${r.coinsCredited} CN`
        : 'Depósito rechazado',
      true);
    $('depositModal').classList.add('hidden');
    selectedDepositId = null;
    await loadDeposits();
  } catch (err) {
    showStatus($('panelStatus'), err.message, false);
  }
}

function showStatus(el, msg, ok = true) {
  el.textContent = msg;
  el.className = `status ${ok ? 'ok' : 'err'}`;
}

async function callFn(name, data = {}) {
  const res = await httpsCallable(fns, name)(data);
  return res.data;
}

async function isOperator(uid) {
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists();
}

async function loadWaitingRooms() {
  const list = $('roomsList');
  if (!list) return;
  list.innerHTML = '<p style="color:#a78bfa;font-size:.85rem">Cargando salas…</p>';
  try {
    const data = await callFn('adminListWaitingMatches', { limit: 60 });
    waitingRoomsCache = data.matches || [];
    if (!waitingRoomsCache.length) {
      list.innerHTML = '<p style="color:#a78bfa;font-size:.85rem">No hay salas ni partidas colgadas.</p>';
      return;
    }
    list.innerHTML = `<table><thead><tr>
      <th>ID</th><th>Estado</th><th>Jugadores</th><th>Modo</th><th>CN</th><th>Edad</th><th></th>
    </tr></thead><tbody>${waitingRoomsCache.map((m) => `<tr>
      <td style="font-family:monospace;font-size:.65rem;max-width:120px;word-break:break-all">${esc(m.id)}</td>
      <td style="${m.stale ? 'color:#f59e0b;font-weight:700' : ''}">${esc(m.status)}${m.phase && m.status === 'playing' ? '<br><span style="font-size:.65rem;color:#a78bfa">' + esc(m.phase) + '</span>' : ''}</td>
      <td>${esc((m.players || []).map((p) => p.name).join(', ') || '—')}<br><span style="color:#a78bfa;font-size:.7rem">${m.playerCount}/${m.maxPlayers}${m.guestOnly ? ' · invitados' : ''}</span></td>
      <td>${esc(m.mode)}</td>
      <td>${m.stakeCC > 0 ? `<b>${m.stakeCC}</b>` : '0'}</td>
      <td style="${m.stale ? 'color:#f59e0b;font-weight:700' : ''}">${m.ageMinutes != null ? m.ageMinutes + ' min' : '—'}</td>
      <td><button type="button" class="btn-warn btn-close-room" data-id="${esc(m.id)}">Cerrar</button></td>
    </tr>`).join('')}</tbody></table>`;
    list.querySelectorAll('.btn-close-room').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!window.confirm('¿Cerrar esta sala y devolver CN si corresponde?')) return;
        try {
          await callFn('adminCloseWaitingMatch', { matchId: btn.dataset.id, reason: 'admin_manual' });
          showStatus($('panelStatus'), 'Sala cerrada.', true);
          await loadWaitingRooms();
        } catch (err) {
          showStatus($('panelStatus'), err.message, false);
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<p style="color:#f87171">${esc(err.message)}</p>`;
  }
}

async function loadTournaments() {
  const list = $('tournamentsList');
  try {
    const data = await callFn('adminListTournaments', { limit: 10 });
    const rows = (data.tournaments || []).map((t) => {
      const parts = (t.participants || []).filter((p) => !String(p).startsWith('__bye__')).length;
      return `<tr>
        <td>${t.weekKey || t.id}</td>
        <td>${t.status || '—'}</td>
        <td>${parts}/${t.bracketSize || 8}</td>
        <td>${t.prizePool ?? 0} CN</td>
      </tr>`;
    }).join('');
    list.innerHTML = rows
      ? `<table><thead><tr><th>Semana</th><th>Estado</th><th>Inscriptos</th><th>Premio</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p style="color:#a78bfa;font-size:.85rem">Sin torneos aún.</p>';
  } catch (err) {
    list.innerHTML = `<p style="color:#f87171">${err.message}</p>`;
  }
}

function fillUserCard(u) {
  selectedUid = u.uid;
  $('userCard').classList.remove('hidden');
  $('uName').textContent = u.displayName || 'Jugador';
  $('uEmail').textContent = u.email || '—';
  $('uUid').textContent = u.uid;
  $('uVip').textContent = u.vipActive ? ' · 👑 VIP' : '';
  $('uCoins').textContent = (u.ceroCoins ?? 0).toLocaleString();
  $('uWins').textContent = u.wins ?? 0;
  $('uGames').textContent = u.totalGamesPlayed ?? 0;
  $('uXp').textContent = u.xp ?? 0;
  $('uWeekly').textContent = u.weeklyWins ?? 0;
  $('uMonthly').textContent = u.monthlyWins ?? 0;
  $('uCountry').textContent = u.countryCode || '—';
  $('uGuest').textContent = u.isGuest ? 'Invitado' : 'Registrado';

  $('editCoins').value = u.ceroCoins ?? 0;
  $('editName').value = u.displayName || '';
  $('editCountry').value = u.countryCode || '';
  $('editWins').value = u.wins ?? 0;
  $('editGames').value = u.totalGamesPlayed ?? 0;
  $('editXp').value = u.xp ?? 0;
  $('editWeekly').value = u.weeklyWins ?? 0;
  $('editMonthly').value = u.monthlyWins ?? 0;
  $('editVip').value = '';
}

function renderSearchResults(users) {
  const box = $('searchResults');
  if (!users.length) {
    box.innerHTML = '<p style="color:#a78bfa;font-size:.85rem;margin-top:12px">Sin coincidencias.</p>';
    return;
  }
  box.innerHTML = `<table><thead><tr>
    <th>Nick</th><th>Email</th><th>CN</th><th>Victorias</th><th></th>
  </tr></thead><tbody>${users.map((u) => `<tr class="search-row" data-uid="${esc(u.uid)}">
    <td><b>${esc(u.displayName)}</b></td>
    <td style="font-size:.75rem;color:#a78bfa">${esc(u.email)}</td>
    <td>${u.ceroCoins ?? 0}</td>
    <td>${u.wins ?? 0}</td>
    <td><button type="button" class="btn-accent btn-sm btn-pick-user" data-uid="${esc(u.uid)}">Abrir</button></td>
  </tr>`).join('')}</tbody></table>`;

  box.querySelectorAll('.btn-pick-user').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const u = await callFn('adminGetUser', { uid: btn.dataset.uid });
        fillUserCard(u);
        showStatus($('panelStatus'), 'Usuario cargado.', true);
        $('userCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        showStatus($('panelStatus'), err.message, false);
      }
    });
  });
}

async function searchUser() {
  const username = $('searchUsername').value.trim();
  const email = $('searchEmail').value.trim();
  const uid = $('searchUid').value.trim();
  if (!username && !email && !uid) {
    showStatus($('panelStatus'), 'Indicá nick, email o UID.', false);
    return;
  }
  const payload = uid ? { uid } : email ? { email } : { displayName: username };
  const u = await callFn('adminGetUser', payload);
  fillUserCard(u);
  $('searchResults').innerHTML = '';
  showStatus($('panelStatus'), 'Usuario encontrado.', true);
  $('userCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function ensurePanelAccess(user) {
  const ok = await isOperator(user.uid);
  if (!ok) {
    showStatus($('loginStatus'), 'Tu cuenta no tiene permisos de operador.', false);
    await signOut(auth);
    return false;
  }
  currentUser = user;
  $('loginSection').classList.add('hidden');
  $('panelSection').classList.remove('hidden');
  $('adminUserLabel').textContent = `${user.email} · operador`;
  await loadTournaments();
  await loadDeposits();
  await loadWaitingRooms();
  await loadAppConfig();
  return true;
}

async function addCoins(delta) {
  if (!selectedUid) {
    showStatus($('panelStatus'), 'Buscá un jugador primero.', false);
    return;
  }
  try {
    const r = await callFn('adminAddCeroCoins', {
      uid: selectedUid,
      amount: delta,
      reason: $('editReason').value.trim() || 'admin_panel_quick',
    });
    $('uCoins').textContent = r.ceroCoins.toLocaleString();
    $('editCoins').value = r.ceroCoins;
    showStatus($('panelStatus'), `Saldo: ${r.ceroCoins} CN (${delta > 0 ? '+' : ''}${delta})`, true);
  } catch (err) {
    showStatus($('panelStatus'), err.message, false);
  }
}

$('btnLogin').addEventListener('click', async () => {
  const email = $('adminEmail').value.trim();
  const pass = $('adminPass').value;
  if (!email || !pass) {
    showStatus($('loginStatus'), 'Completá email y contraseña.', false);
    return;
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await afterAuthSuccess(cred.user);
  } catch (err) {
    showStatus($('loginStatus'), friendlyAuthError(err?.code) || err.message, false);
  }
});

$('btnGoogleAdmin')?.addEventListener('click', () => signInGoogle());

$('btnBioAdmin')?.addEventListener('click', async () => {
  $('btnBioAdmin').disabled = true;
  try {
    await unlockWithBiometric();
  } finally {
    $('btnBioAdmin').disabled = false;
  }
});

$('btnClaimRole').addEventListener('click', async () => {
  try {
    if (!auth.currentUser) {
      showStatus($('loginStatus'), 'Iniciá sesión primero.', false);
      return;
    }
    await callFn('claimOperatorRole');
    showStatus($('loginStatus'), 'Rol operador activado. Recargando…', true);
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    showStatus($('loginStatus'), err.message, false);
  }
});

$('btnSeedMissions').addEventListener('click', async () => {
  try {
    if (!auth.currentUser) {
      showStatus($('loginStatus'), 'Iniciá sesión primero.', false);
      return;
    }
    const res = await callFn('seedMissions', {});
    showStatus($('panelStatus'), `Misiones sembradas: ${res.seeded ?? 0}`, true);
  } catch (err) {
    showStatus($('panelStatus'), err.message, false);
  }
});

$('btnLogout').addEventListener('click', async () => {
  sessionStorage.removeItem(UNLOCK_KEY);
  await signOut(auth);
  location.reload();
});

$('btnSearch').addEventListener('click', async () => {
  try {
    await searchUser();
  } catch (err) {
    showStatus($('panelStatus'), err.message, false);
  }
});

$('btnSearchList').addEventListener('click', async () => {
  const q = $('searchUsername').value.trim() || $('searchEmail').value.trim();
  if (q.length < 2) {
    showStatus($('panelStatus'), 'Escribí al menos 2 caracteres del nick.', false);
    return;
  }
  try {
    const data = await callFn('adminSearchUsers', { query: q, limit: 25 });
    renderSearchResults(data.users || []);
    showStatus($('panelStatus'), `${(data.users || []).length} coincidencia(s).`, true);
  } catch (err) {
    showStatus($('panelStatus'), err.message, false);
  }
});

document.querySelectorAll('.btn-add-coins').forEach((btn) => {
  btn.addEventListener('click', () => addCoins(Number(btn.dataset.delta)));
});

$('btnZeroCoins').addEventListener('click', async () => {
  if (!selectedUid) {
    showStatus($('panelStatus'), 'Buscá un jugador primero.', false);
    return;
  }
  if (!window.confirm('¿Poner saldo en 0 CN? (útil para pruebas)')) return;
  try {
    await callFn('adminSetCeroCoins', {
      uid: selectedUid,
      ceroCoins: 0,
      reason: $('editReason').value.trim() || 'admin_zero_test',
    });
    $('uCoins').textContent = '0';
    $('editCoins').value = 0;
    showStatus($('panelStatus'), 'Saldo en 0 CN.', true);
  } catch (err) {
    showStatus($('panelStatus'), err.message, false);
  }
});

$('btnSetCoins').addEventListener('click', async () => {
  if (!selectedUid) return;
  const ceroCoins = Number($('editCoins').value);
  const reason = $('editReason').value.trim() || 'admin_panel';
  try {
    await callFn('adminSetCeroCoins', { uid: selectedUid, ceroCoins, reason });
    $('uCoins').textContent = ceroCoins.toLocaleString();
    showStatus($('panelStatus'), `Saldo actualizado: ${ceroCoins} CN`, true);
  } catch (err) {
    showStatus($('panelStatus'), err.message, false);
  }
});

$('btnUpdateUser').addEventListener('click', async () => {
  if (!selectedUid) return;
  try {
    const payload = {
      uid: selectedUid,
      displayName: $('editName').value.trim(),
      weeklyWins: Number($('editWeekly').value),
      monthlyWins: Number($('editMonthly').value),
      wins: Number($('editWins').value),
      totalGamesPlayed: Number($('editGames').value),
      xp: Number($('editXp').value),
      countryCode: $('editCountry').value.trim().toUpperCase() || null,
    };
    const vipVal = $('editVip').value;
    if (vipVal === '1') payload.vipActive = true;
    if (vipVal === '0') payload.vipActive = false;

    await callFn('adminUpdateUser', payload);
    $('uName').textContent = $('editName').value.trim();
    $('uWins').textContent = $('editWins').value;
    $('uGames').textContent = $('editGames').value;
    $('uXp').textContent = $('editXp').value;
    $('uWeekly').textContent = $('editWeekly').value;
    $('uMonthly').textContent = $('editMonthly').value;
    $('uCountry').textContent = $('editCountry').value.trim().toUpperCase() || '—';
    if (vipVal === '1') $('uVip').textContent = ' · 👑 VIP';
    if (vipVal === '0') $('uVip').textContent = '';
    showStatus($('panelStatus'), 'Perfil actualizado.', true);
  } catch (err) {
    showStatus($('panelStatus'), err.message, false);
  }
});

$('btnSeedTournament').addEventListener('click', async () => {
  try {
    const r = await callFn('adminSeedWeeklyTournament', {});
    showStatus($('panelStatus'), `Torneo ${r.weekKey} listo (${r.tournamentId})`, true);
    await loadTournaments();
  } catch (err) {
    showStatus($('panelStatus'), err.message, false);
  }
});

$('btnForceSeed').addEventListener('click', async () => {
  if (!window.confirm('¿Forzar inicio del bracket con los inscriptos actuales?')) return;
  try {
    const r = await callFn('adminSeedWeeklyTournament', { forceSeed: true });
    showStatus($('panelStatus'), `Bracket iniciado: ${r.tournamentId}`, true);
    await loadTournaments();
  } catch (err) {
    showStatus($('panelStatus'), err.message, false);
  }
});

$('btnRefreshDeposits').addEventListener('click', () => loadDeposits());
$('btnRefreshRooms')?.addEventListener('click', () => loadWaitingRooms());
$('btnCleanupStale')?.addEventListener('click', async () => {
  if (!window.confirm('¿Cerrar salas en espera con más de 5 minutos?')) return;
  try {
    const r = await callFn('adminCleanupStaleRooms', { minAgeMinutes: 5 });
    showStatus($('panelStatus'), `Listo: ${r.closed} sala(s) cerrada(s).`, true);
    await loadWaitingRooms();
  } catch (err) {
    showStatus($('panelStatus'), err.message, false);
  }
});
$('btnCleanupAllWaiting')?.addEventListener('click', async () => {
  if (!window.confirm('¿Cerrar TODAS las salas waiting y partidas playing colgadas? Se devolverán CN si corresponde.')) return;
  try {
    const r = await callFn('adminCleanupStaleRooms', { minAgeMinutes: 0, limit: 200 });
    showStatus($('panelStatus'), `Listo: ${r.closed} sala(s)/partida(s) cerrada(s).`, true);
    await loadWaitingRooms();
  } catch (err) {
    showStatus($('panelStatus'), err.message, false);
  }
});
$('btnCloseDeposit').addEventListener('click', () => {
  $('depositModal').classList.add('hidden');
  selectedDepositId = null;
});
$('btnApproveDeposit').addEventListener('click', () => reviewDeposit('approve'));
$('btnRejectDeposit').addEventListener('click', () => reviewDeposit('reject'));

['searchUsername', 'searchEmail', 'searchUid'].forEach((id) => {
  $(id)?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btnSearch').click();
  });
});

async function loadAppConfig() {
  try {
    const data = await callFn('adminGetAppConfig', {});
    const c = data.config || {};
    $('cfgStakes').value = (c.roomStakes || []).join(', ');
    $('cfgMin').value = c.stakeMin ?? 30;
    $('cfgMax').value = c.stakeMax ?? 20000;
    $('cfgWaitMin').value = c.waitingRoomMinutes ?? 5;
    $('cfgFreeRooms').checked = c.freeRoomsEnabled !== false;
    $('cfgChaotic').checked = c.chaoticModeEnabled === true;
  } catch (err) {
    showStatus($('panelStatus'), err.message, false);
  }
}

$('btnLoadAppConfig')?.addEventListener('click', () => loadAppConfig());
$('btnSaveAppConfig')?.addEventListener('click', async () => {
  try {
    const stakes = $('cfgStakes').value.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isFinite(n) && n >= 0);
    const payload = {
      roomStakes: stakes.length ? stakes : [0, 30, 50, 100],
      stakeMin: parseInt($('cfgMin').value, 10) || 30,
      stakeMax: parseInt($('cfgMax').value, 10) || 20000,
      waitingRoomMinutes: parseInt($('cfgWaitMin').value, 10) || 5,
      freeRoomsEnabled: $('cfgFreeRooms').checked,
      chaoticModeEnabled: $('cfgChaotic').checked,
    };
    const r = await callFn('adminSetAppConfig', payload);
    showStatus($('panelStatus'), 'Config guardada correctamente.', true);
    if (r.config) {
      $('cfgStakes').value = (r.config.roomStakes || []).join(', ');
    }
  } catch (err) {
    showStatus($('panelStatus'), err.message, false);
  }
});

(async function bootstrapAdminAuth() {
  try {
    await setPersistence(auth, browserLocalPersistence);
    const redirect = await getRedirectResult(auth);
    if (redirect?.user) {
      await afterAuthSuccess(redirect.user);
    }
  } catch (err) {
    showStatus($('loginStatus'), friendlyAuthError(err?.code) || err.message, false);
  }

  updateBioUi();
  platformBioAvailable().then((ok) => {
    if (ok && !getStoredWebAuthn()) {
      const hint = $('bioHint');
      if (hint) {
        hint.hidden = false;
        hint.classList.remove('hidden');
        hint.textContent = 'Después del primer ingreso con Google podés desbloquear con huella o Face ID en este dispositivo.';
      }
    }
  });

  onAuthStateChanged(auth, async (user) => {
    if (authBootstrapped && !user) {
      $('loginSection')?.classList.remove('hidden');
      $('panelSection')?.classList.add('hidden');
      currentUser = null;
      return;
    }
    authBootstrapped = true;
    if (user) await handleAuthUser(user);
  });
})();

