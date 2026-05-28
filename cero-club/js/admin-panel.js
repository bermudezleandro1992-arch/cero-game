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
let depositsCache = [];
let selectedDepositId = null;
let waitingRoomsCache = [];

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
  await loadDeposits();
  await loadWaitingRooms();
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

$('btnRefreshDeposits').addEventListener('click', () => loadDeposits());
$('btnRefreshRooms')?.addEventListener('click', () => loadWaitingRooms());
$('btnCleanupStale')?.addEventListener('click', async () => {
  if (!window.confirm('¿Cerrar salas en espera con más de 4 minutos?')) return;
  try {
    const r = await callFn('adminCleanupStaleRooms', { minAgeMinutes: 4 });
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

onAuthStateChanged(auth, async (user) => {
  if (user) await ensurePanelAccess(user);
});
