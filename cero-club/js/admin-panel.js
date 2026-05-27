/**
 * Panel admin Cero Club — gestión de Cero Coins, usuarios y torneos
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
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

const $ = (id) => document.getElementById(id);

let currentUser = null;
let selectedUid = null;

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
  $('uCoins').textContent = (u.ceroCoins ?? 0).toLocaleString();
  $('uWins').textContent = u.wins ?? 0;
  $('uGames').textContent = u.totalGamesPlayed ?? 0;
  $('editCoins').value = u.ceroCoins ?? 0;
  $('editName').value = u.displayName || '';
  $('editWeekly').value = u.weeklyWins ?? 0;
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
  return true;
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
    const ok = await ensurePanelAccess(cred.user);
    if (ok) showStatus($('panelStatus'), 'Sesión iniciada.', true);
  } catch (err) {
    showStatus($('loginStatus'), err.message, false);
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

$('btnLogout').addEventListener('click', async () => {
  await signOut(auth);
  location.reload();
});

$('btnSearch').addEventListener('click', async () => {
  const email = $('searchEmail').value.trim();
  const uid = $('searchUid').value.trim();
  if (!email && !uid) {
    showStatus($('panelStatus'), 'Indicá email o UID.', false);
    return;
  }
  try {
    const u = await callFn('adminGetUser', uid ? { uid } : { email });
    fillUserCard(u);
    showStatus($('panelStatus'), 'Usuario encontrado.', true);
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
    await callFn('adminUpdateUser', {
      uid: selectedUid,
      displayName: $('editName').value.trim(),
      weeklyWins: Number($('editWeekly').value),
    });
    $('uName').textContent = $('editName').value.trim();
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

onAuthStateChanged(auth, async (user) => {
  if (user) await ensurePanelAccess(user);
});
