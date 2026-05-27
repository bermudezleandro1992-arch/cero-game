'use strict';

// ── Load user from session (set by login page / Firebase Auth) ────────────────
function _loadSessionUser() {
  try {
    const raw = sessionStorage.getItem('cero_user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) { return null; }
}

function buildCeroOnlineUrl(roomId, uid, room = {}) {
  const format = room.format || '1v1';
  const countMap = { '1v1': 2, '2v2': 4, '3v3': 6 };
  const players = room.maxPlayers || countMap[format] || 2;
  const q = new URLSearchParams({
    roomId,
    uid,
    mode: room.mode || 'classic',
    format,
    players: String(players),
    voice: room.voice || 'fem',
  });
  return `/games/cero/index.html?${q}`;
}
window.buildCeroOnlineUrl = buildCeroOnlineUrl;

function _buildMockUser(session) {
  if (!session) {
    return { displayName: 'Juan Díaz', initials: 'JD', coins: 1500, level: 7, gamesPlayed: 42, wins: 18 };
  }
  const name = session.name || session.email?.split('@')[0] || 'Jugador';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return {
    displayName: name,
    name,
    initials,
    coins: session.coins ?? 0,
    level: session.level ?? 1,
    gamesPlayed: session.gamesPlayed ?? 0,
    wins: session.wins ?? 0,
    anon: session.anon,
    photo: session.photo || null,
  };
}

// ── Login gate — redirige a login si no hay sesión activa ─────────────────────
const SESSION_USER = _loadSessionUser();
if (!SESSION_USER) {
  // No hay sesión en absoluto → ir al login
  window.location.replace('login.html');
}

// ── Active user ────────────────────────────────────────────────────────────────
const MOCK_USER = _buildMockUser(SESSION_USER);

// ── Game metadata ──────────────────────────────────────────────────────────────
const GAMES = {
  truco: {
    name: 'Truco',
    icon: '♠',
    path: '/games/truco/index.html',
    available: true, // Phase 2 ✓
  },
  chinchon: {
    name: 'Chinchón',
    icon: '♦',
    path: '/games/chinchon/index.html',
    available: false,
  },
  cero: {
    name: 'Cero',
    icon: '★',
    path: '/games/cero/index.html',
    available: true,
  },
  uno: {
    name: 'UNO',
    icon: '🃏',
    path: '/games/uno/index.html',
    available: true,
  },
};

// ── DOM refs ───────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ── Init ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderProfile(MOCK_USER);
  _updateHeaderAuth();
  // Apply guest restrictions immediately for anonymous session users
  if (SESSION_USER?.anon) _applyGuestRestrictions(true);
  bindNavButtons();
  bindToolsTabs();
  bindRulesAccordion();
  Scorer.truco.init();
  Scorer.chinchon.init();
  initLiveRooms();
  _bindPlayNowGrid();

  function _onFirebaseReady() {
    renderLiveRooms();
    renderTournaments();
    _tryJoinRoomFromUrl();
    if (window._fbUser) renderRanking(_rankingGameFilter);
  }

  window.addEventListener('fb:hubReady', _onFirebaseReady);
  window.addEventListener('fb:authLost', () => {
    window.location.replace('login.html');
  });

  // When Firebase resolves the real profile, re-render everything with real data
  window.addEventListener('fb:profileReady', (e) => {
    const fb = e.detail;
    window._lastFbProfile = fb; // cache for profile modal
    const initials = fb.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const sess = _loadSessionUser() || {};
    sess.name = fb.name;
    sess.coins = fb.coins;
    sess.photo = fb.photo;
    sess.email = fb.email;
    sess.identityVerified = fb.identityVerified;
    sess.rankPoints = fb.rankPoints ?? sess.rankPoints;
    sess.xp = fb.xp ?? sess.xp;
    sess.wins = fb.wins ?? sess.wins;
    sess.gamesPlayed = fb.gamesPlayed ?? sess.gamesPlayed;
    sessionStorage.setItem('cero_user', JSON.stringify(sess));

    renderProfile({
      displayName: fb.name,
      name:        fb.name,
      initials,
      coins:       fb.coins,
      level:       fb.level,
      gamesPlayed: fb.gamesPlayed,
      wins:        fb.wins,
      anon:        fb.anon,
      photo:       fb.photo,
    });
    _updateHeaderAuth();
    // Update mobile profile strip + sidebar
    _updateMobileStrip(fb);
    _syncSidebarProfile({ ...fb, displayName: fb.name });
    if (typeof refreshProfileStats === 'function') refreshProfileStats();
    if (typeof refreshProfileCuenta === 'function') refreshProfileCuenta();
    // Override logout to use Firebase sign-out
    if (window.FBHub) window.logout = window.FBHub.logout;
    // Sync store items from Firestore
    if (fb.uid && !fb.anon) _syncStoreFromFirestore(fb.uid).then(() => renderStore(_storeCat));
    // Refresh real-time data now that Firebase is ready
    renderRanking(_rankingGameFilter);
    renderLiveRooms();
    renderTournaments();
    // Apply guest restrictions if needed
    _applyGuestRestrictions(fb.anon);
  });
});

function _updateHeaderAuth() {
  const loginBtn  = document.getElementById('headerLoginBtn');
  const logoutBtn = document.getElementById('headerLogoutBtn');
  if (!loginBtn || !logoutBtn) return;
  if (SESSION_USER && !SESSION_USER.demo) {
    loginBtn.style.display  = 'none';
    logoutBtn.style.display = '';
  }
}

function _userInitials(name) {
  return String(name || 'J').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function syncAllAvatars(user) {
  const name = user?.displayName || user?.name || 'Jugador';
  const initials = _userInitials(name);
  const photo = user?.photo || null;
  const level = user?.level || 1;

  const spAv = document.getElementById('spAvatar');
  if (spAv) {
    if (photo) {
      spAv.innerHTML = `<img src="${photo}" alt="" class="av-photo-sidebar"/><div class="sp-level" id="avatarLevel">${level}</div>`;
    } else {
      spAv.innerHTML = `<span id="avatarInitials">${initials}</span><div class="sp-level" id="avatarLevel">${level}</div>`;
    }
  }
  const tba = document.getElementById('topbarAvatar');
  if (tba) {
    if (photo) {
      tba.innerHTML = `<img src="${photo}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover"/>`;
    } else {
      tba.textContent = initials;
    }
  }
  const mps = document.getElementById('mpsAvatar');
  if (mps) {
    if (photo) {
      mps.innerHTML = `<img src="${photo}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover"/>`;
    } else {
      mps.textContent = initials;
    }
  }
}

function syncCoinsUI() {
  const s = _loadSessionUser();
  const coins = s?.coins ?? window._fbUser?.coins ?? 0;
  const txt = `◈ ${coins.toLocaleString('es-AR')} CC`;
  ['coinsAmount', 'mpsCoins'].forEach(id => {
    const el = $(id);
    if (el) el.textContent = txt;
  });
  if ($('pfStatCoins')) $('pfStatCoins').textContent = coins.toLocaleString('es-AR');
  if ($('statsCoins')) $('statsCoins').textContent = coins.toLocaleString('es-AR');
}
window.syncCoinsUI = syncCoinsUI;
window.syncAllAvatars = syncAllAvatars;

// Sync sidebar profile elements
function _syncSidebarProfile(user) {
  const nm   = document.getElementById('profileName');
  const cc   = document.getElementById('coinsAmount');
  const nm2  = document.getElementById('mpsName');
  if (nm)  nm.textContent  = user.displayName || user.name || 'Jugador';
  if (nm2) nm2.textContent = user.displayName || user.name || 'Jugador';
  if (cc)  cc.textContent  = `◈ ${(user.coins || 0).toLocaleString('es-AR')} CC`;
  syncAllAvatars(user);
}

// ── Mobile profile strip sync ─────────────────────────────────────────────────
function _updateMobileStrip(fb) {
  const nm  = document.getElementById('mpsName');
  const cc  = document.getElementById('mpsCoins');
  if (nm) nm.textContent = fb.name || fb.displayName || 'Jugador';
  if (cc) cc.textContent = `◈ ${(fb.coins || 0).toLocaleString('es-AR')} CC`;
  syncAllAvatars({
    name: fb.name || fb.displayName,
    displayName: fb.displayName || fb.name,
    photo: fb.photo || null,
    level: fb.level || 1,
  });
}

// ── Guest restrictions: lock premium sections for anonymous users ─────────────
function _applyGuestRestrictions(isAnon) {
  if (!isAnon) {
    // Remove any leftover lock overlays for newly-registered users
    document.querySelectorAll('.guest-lock-overlay').forEach(el => el.remove());
    return;
  }

  // Sections guests can NOT access: ranking full, store, tournament registration
  const lockTargets = [
    { selector: '#rankingPanel',     msg: 'Registrate para ver el ranking completo' },
    { selector: '#storePanel',       msg: 'Registrate para acceder a la tienda' },
    { selector: '#tournamentsPanel', msg: 'Registrate para participar en torneos' },
  ];

  lockTargets.forEach(({ selector, msg }) => {
    const panel = document.querySelector(selector);
    if (!panel || panel.querySelector('.guest-lock-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'guest-lock-overlay';
    overlay.innerHTML = `
      <div class="glo-inner">
        <span class="glo-icon">🔒</span>
        <p class="glo-msg">${msg}</p>
        <button class="glo-btn" onclick="window.location.href='login.html'">Crear cuenta gratis</button>
      </div>`;
    panel.style.position = 'relative';
    panel.appendChild(overlay);
  });

  // Add banner at top of hub
  if (!document.getElementById('guestBanner')) {
    const banner = document.createElement('div');
    banner.id = 'guestBanner';
    banner.className = 'guest-top-banner';
    banner.innerHTML = `
      <span>Estás jugando como <strong>Invitado</strong> — acceso limitado.</span>
      <a href="login.html" class="gtb-link">Registrate gratis →</a>`;
    document.body.insertAdjacentElement('afterbegin', banner);
  }
}

// ── Render user profile ────────────────────────────────────────────────────────
function renderProfile(user) {
  // Avatar — always use the wrapper, never replaceWith to avoid losing the node
  const avatarWrap = $('avatarWrap') || $('avatarInitials')?.parentElement;
  const initialsEl = $('avatarInitials');
  if (user.photo) {
    // Remove old photo if present, keep initials node intact
    const oldImg = avatarWrap?.querySelector('img.av-photo');
    if (oldImg) oldImg.remove();
    const img = document.createElement('img');
    img.src       = user.photo;
    img.alt       = user.displayName;
    img.className = 'av-photo';
    img.style     = 'width:100%;height:100%;object-fit:cover;border-radius:50%;position:absolute;top:0;left:0;';
    if (avatarWrap) avatarWrap.style.position = 'relative';
    if (initialsEl) { initialsEl.style.visibility = 'hidden'; avatarWrap?.appendChild(img); }
  } else if (initialsEl) {
    initialsEl.style.visibility = 'visible';
    initialsEl.textContent      = user.initials || (user.displayName?.[0] || '?').toUpperCase();
  }

  if ($('avatarLevel'))   $('avatarLevel').textContent   = user.level ?? 1;
  if ($('profileName'))   $('profileName').textContent   = user.displayName + (user.anon ? ' 👤' : '');
  if ($('coinsAmount'))   $('coinsAmount').textContent   = `◈ ${(user.coins ?? 0).toLocaleString('es-AR')} CC`;
  if ($('statGames'))     $('statGames').textContent     = user.gamesPlayed ?? 0;
  if ($('statWins'))      $('statWins').textContent      = user.wins ?? 0;
  const rate = (user.gamesPlayed ?? 0) > 0
    ? Math.round(((user.wins ?? 0) / user.gamesPlayed) * 100) : 0;
  if ($('statWinRate'))   $('statWinRate').textContent   = rate + '%';
  syncAllAvatars(user);
  syncCoinsUI();

  // "Iniciar sesión" CTA — show only once, remove if user is now logged in
  const existingCta = document.querySelector('.profile-login-cta');
  if (user.anon || !SESSION_USER) {
    if (!existingCta) {
      const cta = document.createElement('a');
      cta.href        = 'login.html';
      cta.className   = 'profile-login-cta';
      cta.textContent = '🔑 Iniciar sesión';
      $('profileName')?.insertAdjacentElement('afterend', cta);
    }
  } else if (existingCta) {
    existingCta.remove();
  }
}

// ── Logout ─────────────────────────────────────────────────────────────────────
function logout() {
  if (window.FBHub) {
    window.FBHub.logout();   // Firebase sign-out + redirect
  } else {
    sessionStorage.removeItem('cero_user');
    window.location.href = 'login.html';
  }
}
window.logout = logout;

// ── Game options state ─────────────────────────────────────────────────────────
const roomOpts = {
  truco: { points: '15', flor: 'no', mode: '1v1', voice: 'male', stakeCC: 800 },
  cero:  { mode: 'classic', format: '1v1', players: '2', voice: 'fem', allowSpectate: true, stakeType: 'free', stakeCC: 0, isPrivate: false },
};

const STALE_WAITING_MS = 30 * 60 * 1000;
window._myActiveRoomId = null;

// ── Ambient guitar music for truco room modal ──────────────────────────────────
let _trucoModalMusic = null;
function _startTrucoModalMusic() {
  if (typeof TrucoMusic === 'undefined') return;
  if (_trucoModalMusic) return;
  _trucoModalMusic = new TrucoMusic();
  // Browsers require user gesture — start now since modal open was triggered by click
  _trucoModalMusic.start();
}
function _stopTrucoModalMusic() {
  if (_trucoModalMusic) { _trucoModalMusic.stop(); _trucoModalMusic = null; }
}

// ── Open room creation modal ───────────────────────────────────────────────────
async function openRoomModal(gameKey) {
  const user = _loadSessionUser();
  if (user?.uid && !user.anon && window.FriendsSocial?.findMyActiveRoom) {
    try {
      const mine = await FriendsSocial.findMyActiveRoom(user.uid);
      if (mine) {
        window._myActiveRoomId = mine.id;
        _renderMyRoomBar(mine);
        alert('Ya tenés una sala abierta. Usá el panel de abajo para entrar o cerrarla.');
        return;
      }
    } catch (_) { /* ignore */ }
  }
  closeRoomModal();
  const id = gameKey === 'truco' ? 'modalTruco' : 'modalCero';
  const el = $(id);
  if (!el) return;
  el.classList.add('active');
  document.addEventListener('keydown', _escClose);
  el.addEventListener('click', (e) => { if (e.target === el) closeRoomModal(); });

  // Play guitar ambient for truco
  if (gameKey === 'truco') _startTrucoModalMusic();
  if ((gameKey === 'cero' || gameKey === 'truco') && window.FriendsSocial?.renderCeroInviteGrid) {
    FriendsSocial.renderCeroInviteGrid().catch(() => {});
  }
  if (gameKey === 'cero') _syncCeroRoomModalUI();
}

function closeRoomModal() {
  document.querySelectorAll('.room-modal').forEach((m) => m.classList.remove('active'));
  document.removeEventListener('keydown', _escClose);
  _stopTrucoModalMusic();
}
function _escClose(e) { if (e.key === 'Escape') closeRoomModal(); }

// ── Pill selection ─────────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const pill = e.target.closest('.rm-pill');
  if (!pill) return;
  const group = pill.closest('.rm-pills');
  if (!group) return;
  group.querySelectorAll('.rm-pill').forEach((p) => p.classList.remove('active'));
  pill.classList.add('active');

  // Persist to roomOpts
  const groupName = group.dataset.group;
  const val       = pill.dataset.val;
  if (groupName === 'truco-points') roomOpts.truco.points  = val;
  if (groupName === 'truco-flor')   roomOpts.truco.flor    = val;
  if (groupName === 'truco-mode')   roomOpts.truco.mode    = val;
  if (groupName === 'truco-voice')  roomOpts.truco.voice   = val;
  if (groupName === 'cero-mode')  {
    roomOpts.cero.mode = val;
    const note = $('ceroModeNote');
    if (note) note.style.display = val === 'cero' ? 'flex' : 'none';
  }
  if (groupName === 'cero-format') {
    roomOpts.cero.format = val;
    const map = { '1v1': '2', '2v2': '4', '3v3': '6' };
    if (map[val]) roomOpts.cero.players = map[val];
  }
  if (groupName === 'cero-players') roomOpts.cero.players  = val;
  if (groupName === 'cero-voice')   roomOpts.cero.voice    = val;
  if (groupName === 'cero-spectate') roomOpts.cero.allowSpectate = val === 'yes';
  if (groupName === 'cero-room-type') {
    roomOpts.cero.isPrivate = val === 'private';
    const hint = $('ceroPrivateHint');
    if (hint) hint.hidden = !roomOpts.cero.isPrivate;
    const share = $('ceroShareLinkBox');
    if (share) share.hidden = true;
  }
  if (groupName === 'cero-stake-type') {
    roomOpts.cero.stakeType = val;
    const stakes = $('ceroStakeAmounts');
    if (stakes) stakes.hidden = val !== 'coins';
    roomOpts.cero.stakeCC = val === 'free' ? 0 : (roomOpts.cero.stakeCC || 800);
  }
  if (groupName === 'cero-stake') {
    roomOpts.cero.stakeCC = parseInt(val, 10) || 800;
    roomOpts.cero.stakeType = 'coins';
  }
  if (groupName === 'truco-stake')  roomOpts.truco.stakeCC = parseInt(val, 10) || 800;
});

function _syncCeroRoomModalUI() {
  const stakes = $('ceroStakeAmounts');
  if (stakes) stakes.hidden = roomOpts.cero.stakeType !== 'coins';
  const hint = $('ceroPrivateHint');
  if (hint) hint.hidden = !roomOpts.cero.isPrivate;
}

// ── Launch game ────────────────────────────────────────────────────────────────
function launchGame(gameKey) {
  _stopTrucoModalMusic();
  closeRoomModal();
  const game = GAMES[gameKey];
  if (!game) return;
  const opts  = roomOpts[gameKey];
  const query = Object.entries(opts).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  window.location.href = `${game.path}?${query}`;
}

async function launchCeroPrivateRoom() {
  _stopTrucoModalMusic();
  closeRoomModal();
  let user;
  try {
    user = await _ensureFirebaseUser();
  } catch (e) {
    alert(e.message);
    return;
  }
  if (user.anon) {
    alert('Iniciá sesión para invitar amigos a una sala.');
    window.location.href = 'login.html';
    return;
  }
  if (!window.FriendsSocial) {
    alert('Sistema de amigos no cargó. Recargá la página.');
    return;
  }
  const btn = document.querySelector('.btn-cero.rm-play-btn');
  const prevTxt = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Creando sala…'; }
  const opts = { ...roomOpts.cero };
  if (opts.stakeType === 'free') opts.stakeCC = 0;
  const invites = FriendsSocial.getPendingInvites();
  const authUid = window.FBHub?.auth?.currentUser?.uid || user.uid;
  FriendsSocial.createCeroRoomWithInvites(opts, invites).then(info => {
    if (info?.joinLink) {
      navigator.clipboard?.writeText(info.joinLink).catch(() => {});
    }
    if (info?.roomId && authUid) {
      window.location.href = buildCeroOnlineUrl(info.roomId, authUid, opts);
    }
  }).catch(err => {
    alert(_esFirestoreError(err) || 'No se pudo crear la sala');
  }).finally(() => {
    if (btn) { btn.disabled = false; btn.textContent = prevTxt || '★ Crear sala e invitar'; }
  });
}

function _tryJoinRoomFromUrl() {
  const p = new URLSearchParams(location.search);
  const game = p.get('join');
  const roomId = p.get('room');
  const code = p.get('code');
  if (!game || !roomId || !code || !window.FriendsSocial?.joinRoomByLink) return;
  const user = _loadSessionUser();
  if (!user?.uid || user.anon) {
    sessionStorage.setItem('cero_pending_join', JSON.stringify({ game, roomId, code }));
    return;
  }
  history.replaceState(null, '', location.pathname);
  FriendsSocial.joinRoomByLink(roomId, code).catch(err => {
    alert(err.message || 'No se pudo entrar a la sala');
  });
}

window.launchCeroPrivateRoom = launchCeroPrivateRoom;

async function launchTrucoPrivateRoom() {
  _stopTrucoModalMusic();
  closeRoomModal();
  let user;
  try {
    user = await _ensureFirebaseUser();
  } catch (e) {
    alert(e.message);
    return;
  }
  if (user.anon) {
    alert('Iniciá sesión para invitar amigos a una sala.');
    window.location.href = 'login.html';
    return;
  }
  if (!window.FriendsSocial) {
    alert('Sistema de amigos no cargó. Recargá la página.');
    return;
  }
  const btn = document.querySelector('.btn-truco.rm-play-btn');
  const prevTxt = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Creando sala…'; }
  const opts = { ...roomOpts.truco };
  const invites = FriendsSocial.getPendingInvites();
  FriendsSocial.createTrucoRoomWithInvites(opts, invites).catch(err => {
    alert(err.message || 'No se pudo crear la sala');
  }).finally(() => {
    if (btn) { btn.disabled = false; btn.textContent = prevTxt || '♠ Crear sala e invitar'; }
  });
}
window.launchTrucoPrivateRoom = launchTrucoPrivateRoom;

// ── Join an open room (placeholder for Phase 3) ────────────────────────────────
function joinRoom(gameKey, roomId) {
  console.log(`[Cero Club] Joining room ${roomId} for ${gameKey}`);
  openRoomModal(gameKey);
}

// ── Nav tabs ──────────────────────────────────────────────────────────────────
function bindNavButtons() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// ── Tools tabs (Anotadores / Reglamentos / Legal) ─────────────────────────────
function bindToolsTabs() {
  document.querySelectorAll('.tools-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.tools-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tools-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById(`panel-${target}`);
      if (panel) panel.classList.add('active');
    });
  });
}

// ── Rules accordion ───────────────────────────────────────────────────────────
function bindRulesAccordion() {
  document.querySelectorAll('.rule-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.rule-item');
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.rule-item').forEach((i) => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });
}

// ── SCORER MODULE ─────────────────────────────────────────────────────────────
const Scorer = {

  // ── Truco Scorer ────────────────────────────────────────────────
  truco: (() => {
    const MAX = 15;
    const scores = [0, 0];

    function renderPalitos(elId, score) {
      const el = document.getElementById(elId);
      if (!el) return;
      el.innerHTML = '';
      const full = Math.floor(score / 5);
      const remainder = score % 5;
      for (let g = 0; g < full; g++) {
        const group = document.createElement('div');
        group.className = 'palito-group';
        for (let i = 0; i < 4; i++) {
          const p = document.createElement('div');
          p.className = 'palito';
          group.appendChild(p);
        }
        const cross = document.createElement('div');
        cross.className = 'palito palito-cross';
        group.appendChild(cross);
        el.appendChild(group);
      }
      if (remainder > 0) {
        const group = document.createElement('div');
        group.className = 'palito-group';
        for (let i = 0; i < Math.min(remainder, 4); i++) {
          const p = document.createElement('div');
          p.className = 'palito';
          group.appendChild(p);
        }
        el.appendChild(group);
      }
    }

    function render() {
      ['A', 'B'].forEach((team, i) => {
        const val = $(`trucoVal${team}`);
        const pal = `trucoPalitos${team}`;
        if (val) val.textContent = scores[i];
        renderPalitos(pal, scores[i]);
        if (scores[i] >= MAX) {
          const name = $(`trucoName${team}`)?.value || (i === 0 ? 'Nosotros' : 'Ellos');
          setTimeout(() => alert(`🏆 ¡${name} llegó a 15! Ganan el partido.`), 50);
        }
      });
    }

    return {
      init() { render(); },
      inc(team) { if (scores[team] < MAX) { scores[team]++; render(); } },
      dec(team) { if (scores[team] > 0) { scores[team]--; render(); } },
      reset() { scores[0] = 0; scores[1] = 0; render(); },
    };
  })(),

  // ── Chinchón Scorer ──────────────────────────────────────────────
  chinchon: (() => {
    const DANGER = 80;
    let players = [
      { name: 'Jugador 1', score: 0 },
      { name: 'Jugador 2', score: 0 },
    ];

    function render() {
      const container = $('chinchonPlayers');
      if (!container) return;
      container.innerHTML = '';
      players.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'chinchon-player-row';
        const danger = p.score >= DANGER;
        row.innerHTML = `
          <input value="${p.name}" oninput="Scorer.chinchon.rename(${i}, this.value)" />
          <button class="sc-btn sc-minus" onclick="Scorer.chinchon.dec(${i})">−</button>
          <span class="chinchon-score-display ${danger ? 'danger' : ''}">${p.score}</span>
          <button class="sc-btn sc-plus" onclick="Scorer.chinchon.inc(${i})">+</button>
        `;
        container.appendChild(row);
      });
    }

    return {
      init() { render(); },
      inc(i)  { players[i].score += 1; render(); },
      dec(i)  { if (players[i].score > 0) { players[i].score--; render(); } },
      rename(i, name) { players[i].name = name; },
      addPlayer() {
        if (players.length >= 6) return;
        players.push({ name: `Jugador ${players.length + 1}`, score: 0 });
        render();
      },
      reset() { players.forEach((p) => { p.score = 0; }); render(); },
    };
  })(),
};

// ── Generic modal helpers ──────────────────────────────────────────────────────
function openModal(id) {
  if (id === 'modalProfile') {
    if (window.FriendsSocial?.applyProfileTabIntent) {
      FriendsSocial.applyProfileTabIntent();
    } else if (window.FriendsSocial?.switchProfileTab) {
      FriendsSocial.switchProfileTab('perfil');
    }
    if (window.ProfileAvatar?.initModal) setTimeout(() => window.ProfileAvatar.initModal(), 0);
    _initProfileModal();
  }
  if (id === 'modalCoins' && window.CeroWallet?.refresh) {
    setTimeout(() => CeroWallet.refresh(), 0);
  }
  document.querySelectorAll('.room-modal').forEach(m => m.classList.remove('active'));
  const el = $(id);
  if (el) {
    el.classList.add('active');
    // Use a named handler stored on the element so it can be removed
    if (!el._bgClickHandler) {
      el._bgClickHandler = (e) => { if (e.target === el) closeModal(id); };
      el.addEventListener('click', el._bgClickHandler);
    }
  }
  // Remove first to avoid accumulation, then re-add
  document.removeEventListener('keydown', _escClose);
  document.addEventListener('keydown', _escClose);
}
function closeModal(id) {
  const el = $(id);
  if (el) el.classList.remove('active');
  // Remove keydown if no modal is open
  const anyOpen = document.querySelector('.room-modal.active');
  if (!anyOpen) document.removeEventListener('keydown', _escClose);
}
window.openModal  = openModal;
window.closeModal = closeModal;

// ── Live Rooms ─────────────────────────────────────────────────────────────────
const _NAMES = ['El Gaucho','Maria_BA','TrucoKing','JugadorARG','CeroMaster','La Negra','PicoRoto','FlorcitaRio','BillGaming','IvanARG'];
function _rndName() { return _NAMES[Math.floor(Math.random() * _NAMES.length)]; }

// Mock rooms shown as fallback when Firestore has no active rooms yet
function _mockRooms() {
  return [
    { id:'r1', game:'truco', p1:_rndName(), p2:_rndName(), score:[Math.floor(Math.random()*13),Math.floor(Math.random()*13)], status:'playing',  ts: Date.now()-180000 },
    { id:'r2', game:'cero',  p1:_rndName(), p2:_rndName(), cards:[Math.floor(Math.random()*6)+1,Math.floor(Math.random()*6)+1], status:'playing', ts: Date.now()-60000  },
    { id:'r3', game:'truco', p1:_rndName(), p2:'Esperando...', status:'waiting', ts: Date.now()-15000 },
    { id:'r4', game:'cero',  p1:_rndName(), p2:_rndName(), cards:[Math.floor(Math.random()*5)+1,Math.floor(Math.random()*5)+1], status:'playing',  ts: Date.now()-300000 },
  ];
}

let _roomsUnsub = null;

function _roomAgeMs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return Date.now() - ts.toMillis();
  if (typeof ts === 'number') return Date.now() - ts;
  return 0;
}

function _cleanLabel(v) {
  const t = String(v ?? '').trim();
  if (!t || t === 'undefined' || t === 'null') return '';
  return t;
}

/** Normaliza documento Firestore → fila del Hub. null = descartar sala inválida. */
function _normalizeLiveRoom(docSnap) {
  const d = docSnap.data();
  if (!d) return null;

  const status = _cleanLabel(d.status);
  if (status !== 'waiting' && status !== 'playing') return null;

  if (d.isPrivate) return null;
  if (d.pairKey) return null;

  const ids = d.playerIds || [];
  const maxP = d.maxPlayers || 2;
  if (status === 'waiting' && ids.length >= maxP) return null;

  const age = _roomAgeMs(d.lastActivity || d.createdAt);
  if (status === 'waiting' && age > STALE_WAITING_MS) return null;

  const players = Array.isArray(d.players)
    ? d.players.filter(p => p && _cleanLabel(p.name))
    : [];
  const hostId  = d.hostId || d.playerIds?.[0] || players[0]?.uid;
  const hostPlayer = players.find(p => p.uid === hostId) || players[0];
  const hostName = _cleanLabel(d.hostName || hostPlayer?.name);
  if (!hostName) return null;

  const game = d.game === 'cero' ? 'cero' : d.game === 'truco' ? 'truco' : null;
  if (!game) return null;

  const mode = d.mode || d.trucoOpts?.mode || '1v1';
  const pts  = d.trucoOpts?.points || 15;

  let p1 = hostName;
  let p2 = 'Esperando rival…';

  const uniqueIds = new Set(players.map(p => p.uid).filter(Boolean));
  if (uniqueIds.size < players.length) return null;

  if (players.length >= 2) {
    const guest = players.find(p => p.uid !== hostId) || players[1];
    if (!guest || guest.uid === hostId) return null;
    p2 = _cleanLabel(guest?.name) || 'Rival';
    if (p2 === p1) p2 = 'Rival';
  } else if (mode === '2v2' || mode === '3v3') {
    const teamSize = mode === '2v2' ? 2 : 3;
    p1 = `Equipo A · ${hostName}`;
    p2 = players.length > 1
      ? `Equipo B · ${players.slice(1).map(p => _cleanLabel(p.name)).filter(Boolean).join(' / ')}`
      : 'Equipo B · …';
  }

  if (!_cleanLabel(p1) || String(p2).includes('undefined')) return null;

  const score = d.trucoPvp?.score || d.trucoPvP?.score || d.score || null;
  const sc0 = score?.player ?? score?.[0] ?? 0;
  const sc1 = score?.cpu ?? score?.[1] ?? 0;

  return {
    id: docSnap.id,
    game,
    status,
    p1,
    p2,
    hostName,
    hostId,
    mode,
    pts,
    score: [sc0, sc1],
    cards: d.handCounts ? [d.handCounts[hostId] || 0, 0] : [0, 0],
    ts: d.lastActivity || d.createdAt,
    playerCount: players.length,
    maxPlayers: d.maxPlayers || 2,
    allowSpectate: d.allowSpectate !== false,
    stakeCC: d.stakeCC || 0,
  };
}

function _renderMyRoomBar(roomData) {
  const bar = document.getElementById('myRoomBar');
  if (!bar) return;
  if (!roomData?.id) {
    bar.hidden = true;
    window._myActiveRoomId = null;
    return;
  }
  window._myActiveRoomId = roomData.id;
  const game = roomData.game === 'cero' ? 'CERO' : 'Truco';
  const st = roomData.status === 'playing' ? 'En partida' : 'Esperando jugadores';
  const n = (roomData.playerIds?.length || roomData.players?.length || 1);
  const max = roomData.maxPlayers || 2;
  const stakeLbl = roomData.stakeCC
    ? ` · Pozo ◈ ${((roomData.stakeCC || 0) * (roomData.stakesPaid?.length || n)).toLocaleString('es-AR')} CC`
    : '';
  bar.hidden = false;
  bar.innerHTML = `
    <div class="my-room-inner">
      <div class="my-room-info">
        <span class="my-room-tag">Tu sala · ${game}${stakeLbl}</span>
        <span class="my-room-status">${st} · ${n}/${max}</span>
      </div>
      <div class="my-room-actions">
        <button type="button" class="my-room-enter" onclick="enterMyRoom()">Entrar</button>
        <button type="button" class="my-room-close" onclick="openAbandonModal()">${roomData.status === 'playing' ? 'Abandonar' : 'Cerrar sala'}</button>
      </div>
    </div>`;
}

async function enterMyRoom() {
  const id = window._myActiveRoomId;
  const user = _loadSessionUser();
  if (!id || !user?.uid) return;
  const snap = await window.FBHub?.getDoc(window.FBHub.doc(window.FBHub.db, 'rooms', id));
  const game = snap?.data()?.game || 'cero';
  if (game === 'cero') {
    const d = snap?.data() || {};
    window.location.href = buildCeroOnlineUrl(id, user.uid, d);
  } else {
    window.location.href = `/games/truco/index.html?roomId=${id}&uid=${user.uid}&pvp=1`;
  }
}

async function openAbandonModal() {
  const id = window._myActiveRoomId;
  if (!id || !window.FBHub?.db) return;
  try {
    const snap = await window.FBHub.getDoc(window.FBHub.doc(window.FBHub.db, 'rooms', id));
    if (!snap.exists()) {
      window._myActiveRoomId = null;
      _renderMyRoomBar(null);
      return;
    }
    const d = snap.data();
    const playing = d.status === 'playing';
    const stake = d.stakeCC || 0;
    const paid = (d.stakesPaid || []).length;
    const pot = stake * paid;
    const rival = (d.players || []).find(p => p.uid !== _loadSessionUser()?.uid);
    const rivalName = rival?.name || 'el otro jugador';

    const title = $('abandonTitle');
    const body = $('abandonBody');
    const warn = $('abandonWarn');
    if (title) title.textContent = playing ? '¿Abandonar la partida?' : '¿Cerrar esta sala?';
    if (body) {
      body.innerHTML = playing
        ? `<p>Si abandonás ahora, <strong>${escapeHtml(rivalName)}</strong> gana la partida por abandono.</p>`
        : '<p>La sala se cerrará y los invitados no podrán unirse.</p>';
    }
    if (warn) {
      if (stake > 0 && playing) {
        warn.hidden = false;
        warn.innerHTML = `◈ Pozo Skill Gaming: <strong>${pot.toLocaleString('es-AR')} CC</strong> (${paid} jugador${paid !== 1 ? 'es' : ''} × ${stake.toLocaleString('es-AR')} CC). El ganador recibe el pozo en su cuenta.`;
      } else if (stake > 0 && !playing) {
        warn.hidden = false;
        warn.innerHTML = `Se te devolverán tus <strong>${stake.toLocaleString('es-AR')} CC</strong> si nadie más entró a la sala.`;
      } else {
        warn.hidden = true;
      }
    }
    window._abandonRoomId = id;
    openModal('modalAbandon');
  } catch (e) {
    alert(e.message || 'No se pudo cargar la sala');
  }
}

function _esFirestoreError(e) {
  const m = String(e?.message || e || '');
  if (m.includes('Expected type') && m.includes('Firestore')) {
    return 'Error al guardar en la base de datos. Recargá con Ctrl+F5 e intentá de nuevo.';
  }
  if (m.includes('permission-denied')) return 'No tenés permiso para esta acción. Verificá tu sesión.';
  if (m.includes('Necesitás al menos')) return m;
  return m || 'Ocurrió un error. Intentá de nuevo.';
}

async function confirmAbandonRoom() {
  const id = window._abandonRoomId || window._myActiveRoomId;
  closeModal('modalAbandon');
  if (!id || !window.FriendsSocial?.closeRoom) return;
  try {
    await FriendsSocial.closeRoom(id);
    window._myActiveRoomId = null;
    window._abandonRoomId = null;
    _renderMyRoomBar(null);
    if (typeof window.syncCoinsUI === 'function') syncCoinsUI();
  } catch (e) {
    alert(_esFirestoreError(e));
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function closeMyRoom() {
  openAbandonModal();
}

function _renderRoomList(rooms) {
  const grid = $('liveRoomsGrid');
  if (!grid) return;
  // Update stats bar room count
  const hsbRooms = document.getElementById('hsb-rooms');
  if (hsbRooms) hsbRooms.textContent = rooms.length;
  grid.innerHTML = '';
  if (!rooms.length) {
    grid.innerHTML = `
      <div class="lr-empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".35"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v4M12 16h.01"/></svg>
        <p>No hay salas activas ahora</p>
        <span>¡Sé el primero en crear una!</span>
      </div>`;
    return;
  }
  rooms.forEach(room => {
    const el = document.createElement('div');
    el.className = `live-room lr-${room.game}`;
    const tsMs   = room.ts instanceof Object ? room.ts.toMillis?.() ?? Date.now() : (room.ts || Date.now());
    const elapsed = Math.round((Date.now() - tsMs) / 60000);
    const timeStr = elapsed < 1 ? 'hace un momento' : `hace ${elapsed} min`;
    const statusHTML = room.status === 'playing'
      ? `<span class="lr-status lr-playing">● Jugando</span>`
      : `<span class="lr-status lr-waiting">● Esperando rival</span>`;
    const ptsLbl = room.game === 'truco' ? ` · ${room.pts || 15} pts` : '';
    const stakeLbl = room.stakeCC ? ` · ◈ ${room.stakeCC.toLocaleString('es-AR')} CC` : '';
    const infoHTML = room.game === 'truco' && room.status === 'playing'
      ? `<span class="lr-score">${room.p1} <strong>${(room.score||[0,0])[0]}</strong> – <strong>${(room.score||[0,0])[1]}</strong> ${room.p2}${ptsLbl}</span>`
      : room.game === 'cero' && room.status === 'playing'
        ? `<span class="lr-score">${room.p1} (${(room.cards||[0,0])[0]}🃏) vs ${room.p2} (${(room.cards||[0,0])[1]}🃏)</span>`
        : `<span class="lr-score">${room.p1}${ptsLbl}${stakeLbl} · ${room.p2}</span>`;
    el.innerHTML = `
      <div class="lr-header">
        <span class="lr-game-badge ${room.game}">${room.game === 'truco' ? '♠ Truco' : '★ Cero'}</span>
        ${statusHTML}
      </div>
      ${infoHTML}
      <div class="lr-footer">
        <span class="lr-time">${timeStr}</span>
        ${room.status === 'playing' && room.allowSpectate
          ? `<button class="lr-spectate-btn" onclick="spectateRoom('${room.id}')">👁 Espectear</button>`
          : room.status === 'waiting'
            ? `<button class="lr-join-btn" onclick="joinQuickRoom('${room.id}','${room.game}')">Unirse</button>`
            : ''}
      </div>`;
    grid.appendChild(el);
  });
}

function renderLiveRooms() {
  const grid = document.getElementById('liveRoomsGrid');
  if (!window.FBHub?.db) {
    if (grid) grid.innerHTML = '<p class="lr-empty lr-connecting">Conectando en tiempo real...</p>';
    return;
  }
  if (!window.FBHub.currentUser) {
    if (grid) {
      grid.innerHTML = '<p class="lr-empty">Iniciá sesión para ver salas en vivo.</p>';
    }
    return;
  }

  if (_roomsUnsub) _roomsUnsub();
  const { db, collection, query, where, orderBy, limit: fbLimit, onSnapshot } = window.FBHub;

  const applySnap = snap => {
    const uid = _loadSessionUser()?.uid;
    let myRaw = null;
    if (uid) {
      myRaw = snap.docs.find(d => {
        const data = d.data();
        return (data.playerIds || []).includes(uid)
          && (data.status === 'waiting' || data.status === 'playing');
      });
      if (myRaw) {
        const data = myRaw.data();
        _renderMyRoomBar({ id: myRaw.id, ...data });
        if (data.status === 'finished' && (data.winner || data.forfeit?.winnerUid)) {
          if (!data.prizeSettled && (data.stakeCC || 0) > 0 && window.RoomPrizes?.settle) {
            window.RoomPrizes.settle(myRaw.id).catch(() => {});
          }
          if (window.MatchRewards?.applyMyReward) {
            window.MatchRewards.applyMyReward(myRaw.id, data).catch(() => {});
          }
          if (data.winner === uid || data.forfeit?.winnerUid === uid) {
            if (typeof syncCoinsUI === 'function') syncCoinsUI();
          }
          _renderMyRoomBar(null);
          window._myActiveRoomId = null;
        }
      } else _renderMyRoomBar(null);
    }

    const seenWaitingHost = new Set();
    const rooms = snap.docs
      .map(_normalizeLiveRoom)
      .filter(Boolean)
      .filter(r => r.id !== window._myActiveRoomId)
      .filter(r => {
        if (r.status !== 'waiting') return true;
        const key = `${r.game}-${r.hostId || r.hostName}`;
        if (seenWaitingHost.has(key)) return false;
        seenWaitingHost.add(key);
        return true;
      });
    _renderRoomList(rooms);
  };

  const q = query(
    collection(db, 'rooms'),
    where('status', 'in', ['playing', 'waiting']),
    orderBy('createdAt', 'desc'),
    fbLimit(20),
  );

  _roomsUnsub = onSnapshot(q, applySnap, err => {
    console.warn('[Hub] Rooms listener error:', err.message);
    const qSimple = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'), fbLimit(24));
    _roomsUnsub = onSnapshot(qSimple, applySnap, () => {
      const grid = document.getElementById('liveRoomsGrid');
      if (grid) grid.innerHTML = '<p class="lr-empty">No hay salas activas. ¡Creá la primera!</p>';
    });
  });
}

function spectateRoom(roomId) {
  const user = _loadSessionUser();
  if (!user || user.anon) {
    openModal('modalSpectate');
    return;
  }
  // Redirect to spectator view
  window.location.href = `/games/cero/spectate.html?roomId=${roomId}`;
}

async function joinQuickRoom(roomId, game) {
  let user;
  try {
    user = await _ensureFirebaseUser();
  } catch (e) {
    alert(e.message || 'Iniciá sesión para unirte.');
    window.location.href = 'login.html';
    return;
  }
  if (!user?.uid) {
    alert('Iniciá sesión para unirte a una sala.');
    window.location.href = 'login.html';
    return;
  }
  if (window._myActiveRoomId && window._myActiveRoomId !== roomId) {
    alert('Ya tenés otra sala abierta. Cerrala desde el panel inferior.');
    return;
  }
  try {
    const fb = window.FBHub;
    if (fb?.db) {
      const snap = await fb.getDoc(fb.doc(fb.db, 'rooms', roomId));
      if (!snap.exists()) throw new Error('La sala ya no existe');
      const d = snap.data();
      if (d.isPrivate) throw new Error('Sala privada. Pedí invitación al host.');
      if (d.status !== 'waiting') throw new Error('La sala ya empezó o terminó');
      const ids = d.playerIds || [];
      const max = d.maxPlayers || 2;
      if (!ids.includes(user.uid) && ids.length >= max) throw new Error('La sala está llena');
    }
    if (game === 'cero' && window.FriendsSocial?.joinOpenRoom) {
      await FriendsSocial.joinOpenRoom(roomId);
    } else {
      await _joinTrucoRoom(roomId, user);
    }
  } catch (e) {
    alert(e.message || 'No se pudo unir a la sala');
  }
}

async function _joinTrucoRoom(roomId, user) {
  const fb = window.FBHub;
  if (!fb) throw new Error('Sin conexión');
  const roomRef = fb.doc(fb.db, 'rooms', roomId);
  const snap = await fb.getDoc(roomRef);
  if (!snap.exists()) throw new Error('La sala ya no existe');
  const d = snap.data();
  if (d.status !== 'waiting') throw new Error('La sala ya empezó o terminó');
  const ids = d.playerIds || [];
  if (ids.includes(user.uid)) {
    window.location.href = `/games/truco/index.html?roomId=${roomId}&uid=${user.uid}&pvp=1`;
    return;
  }
  const max = d.maxPlayers || 2;
  if (ids.length >= max) throw new Error('La sala está llena');
  const players = [...(d.players || []), { uid: user.uid, name: user.name || 'Jugador', photo: user.photo || null }];
  await fb.updateDoc(roomRef, {
    players,
    playerIds: [...ids, user.uid],
    [`ready_${user.uid}`]: true,
    lastActivity: fb.serverTimestamp(),
  });
  window.location.href = `/games/truco/index.html?roomId=${roomId}&uid=${user.uid}&pvp=1`;
}

// ── Matchmaking ────────────────────────────────────────────────────────────────
let _mmTimer         = null;
let _mmCountInterval = null;   // tracked so cancelQuickPlay can clear it

function _bindPlayNowGrid() {
  const grid = document.getElementById('playNowGrid');
  if (!grid || grid._bound) return;
  grid._bound = true;
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-play-game]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    playNowPick(btn.dataset.playGame);
  });
}

function playNowPick(game) {
  if (!GAMES[game]) return;
  closeModal('modalRoomSelector');
  void startQuickPlay(game);
}

async function _ensureFirebaseUser(maxMs = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const authU = window.FBHub?.auth?.currentUser;
    const sess = _loadSessionUser();
    if (authU?.uid) {
      return {
        uid: authU.uid,
        name: sess?.name || authU.displayName || 'Jugador',
        photo: sess?.photo || null,
        anon: authU.isAnonymous,
      };
    }
    await new Promise(r => setTimeout(r, 120));
  }
  throw new Error('Sesión no lista. Recargá el hub (F5).');
}

async function startQuickPlay(game) {
  closeRoomModal();
  closeModal('modalRoomSelector');
  cancelQuickPlay();

  if (!window.MM?.join) {
    alert('Cola de matchmaking no cargó. Recargá con Ctrl+Shift+R.');
    return;
  }

  let user;
  try {
    await new Promise((resolve, reject) => {
      if (window.FBHub?.db && window.FBHub?.auth?.currentUser) {
        resolve();
        return;
      }
      const t = setTimeout(() => reject(new Error('Firebase no listo. Recargá el lobby (F5).')), 12000);
      const onReady = () => {
        if (window.FBHub?.db) {
          clearTimeout(t);
          window.removeEventListener('fb:hubReady', onReady);
          resolve();
        }
      };
      window.addEventListener('fb:hubReady', onReady);
      onReady();
    });
    user = await _ensureFirebaseUser();
  } catch (e) {
    alert(e.message);
    return;
  }

  const mmModal = $('modalMatchmaking');
  const mmTitle = $('mmTitle');
  const mmGame  = $('mmGame');
  const mmCount = $('mmQueueCount');
  if (!mmModal) return;

  const gameLabel = game === 'truco'
    ? '♠ Truco rápido · 1 vs 1'
    : '★ Cero rápido · 1 vs 1';
  if (mmGame)  mmGame.textContent  = gameLabel;
  if (mmTitle) mmTitle.textContent = 'Buscando rival (1 vs 1)...';
  if (mmCount) mmCount.textContent = '1 en cola';
  mmModal.classList.add('active');

  // Matchmaking real: registrados e invitados (Firebase Auth)
  if (window.FBHub && user.uid) {
    const mmOpts = { quick: true, mode: 'classic', format: '1v1' };
    try {
      const { roomId } = await window.MM.join(game, user, mmOpts, (msg) => {
        if (mmTitle) mmTitle.textContent = msg;
      }, (n) => {
        if (mmCount) mmCount.textContent = `${n} en cola`;
      });
      mmModal.classList.remove('active');
      const path = game === 'truco' ? '/games/truco/index.html' : '/games/cero/index.html';
      const qs = game === 'truco'
        ? `roomId=${roomId}&uid=${encodeURIComponent(user.uid)}&pvp=1&points=${encodeURIComponent(roomOpts.truco.points)}&flor=${encodeURIComponent(roomOpts.truco.flor)}&mode=${encodeURIComponent(roomOpts.truco.mode)}&voice=${encodeURIComponent(roomOpts.truco.voice)}`
        : `roomId=${roomId}&uid=${encodeURIComponent(user.uid)}&mode=classic&format=1v1&players=2`;
      window.location.assign(`${path}?${qs}`);
    } catch (err) {
      mmModal.classList.remove('active');
      if (err.message !== 'cancelled') {
        const msg = err.message === 'timeout'
          ? 'No hubo rival en 90 segundos. Probá de nuevo o creá sala e invitá a un amigo.'
          : (err.message || 'Error de conexión en la cola. Recargá con Ctrl+F5 e intentá otra vez.');
        alert(msg);
      }
    }
    return;
  }

  alert('Iniciá sesión para jugar contra personas reales.');
}

function cancelQuickPlay() {
  if (window.MM) MM.cancel();
  clearTimeout(_mmTimer);
  clearInterval(_mmCountInterval);
  _mmTimer = _mmCountInterval = null;
  closeModal('modalMatchmaking');
}

// ── Profile edit ───────────────────────────────────────────────────────────────
async function saveProfile() {
  const name   = $('pfName')?.value?.trim();
  const active = document.querySelector('.av-color.selected');
  if (!name) { alert('Ingresá un nombre de jugador.'); return; }
  const session = _loadSessionUser() || {};
  session.name  = name;
  if (active) session.avatarColor = active.dataset.color;
  sessionStorage.setItem('cero_user', JSON.stringify(session));

  // Update all visible name/initials elements
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if ($('profileName'))   $('profileName').textContent   = name;
  if ($('avatarInitials')) $('avatarInitials').textContent = initials;
  if ($('mpsName'))       $('mpsName').textContent       = name;
  if ($('topbarAvatar'))  $('topbarAvatar').textContent  = initials;
  const spAv = $('spAvatar');
  if (spAv && !spAv.querySelector('img')) spAv.querySelector('span') && (spAv.querySelector('span').textContent = initials);

  // Sync to Firestore if Firebase is active
  if (window.FBHub && session.uid) {
    try {
      const { db, doc, updateDoc } = window.FBHub;
      const data = { displayName: name };
      if (active) data.avatarColor = active.dataset.color;
      await updateDoc(doc(db, 'users', session.uid), data);
    } catch (e) { console.warn('[Hub] saveProfile Firestore error:', e); }
  }
  closeModal('modalProfile');
  // Show brief success feedback
  const btn = document.querySelector('#modalProfile .mm-action-btn');
  if (btn) { btn.textContent = '✓ ¡Guardado!'; setTimeout(() => btn.textContent = '✓ Guardar cambios', 2000); }
}
window.saveProfile = saveProfile;

function refreshProfileStats() {
  const fb = window._lastFbProfile || window._fbUser || _loadSessionUser() || {};
  const games = fb.gamesPlayed ?? 0;
  const wins = fb.wins ?? 0;
  const rate = games > 0 ? Math.round((wins / games) * 100) : 0;
  const coins = fb.coins ?? 0;
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('statsWins', wins);
  set('statsGames', games);
  set('statsWinRate', rate + '%');
  set('statsCoins', coins.toLocaleString('es-AR'));
  set('statsWinRateLbl', rate + '%');
  set('statsRatioLbl', `${wins} victorias / ${games} partidas`);
  set('statsRatioPct', rate + '%');
  const bar1 = $('statsWinRateBar');
  const bar2 = $('statsRatioBar');
  if (bar1) bar1.style.width = rate + '%';
  if (bar2) bar2.style.width = rate + '%';
}
window.refreshProfileStats = refreshProfileStats;

function refreshProfileCuenta() {
  const s = _loadSessionUser() || {};
  const fb = window._lastFbProfile || window._fbUser || {};
  const emailEl = $('cuentaEmail');
  if (emailEl) emailEl.textContent = s.email || fb.email || '—';
  const badge = $('cuentaProviderBadge');
  if (badge) badge.textContent = s.email?.includes('@') ? '✓ Email verificado' : 'Cuenta registrada';
  const voice = s.gameVoice || localStorage.getItem('cero_game_voice') || 'fem';
  document.querySelectorAll('.voice-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.voice === voice);
    btn.onclick = () => {
      document.querySelectorAll('.voice-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      localStorage.setItem('cero_game_voice', btn.dataset.voice);
      const sess = _loadSessionUser();
      if (sess) {
        sess.gameVoice = btn.dataset.voice;
        sessionStorage.setItem('cero_user', JSON.stringify(sess));
      }
    };
  });
}
window.refreshProfileCuenta = refreshProfileCuenta;

function _initProfileModal() {
  const session   = _loadSessionUser();
  const pfName    = $('pfName');
  const editAvatar = $('profileEditAvatar');
  const curName   = session?.name || MOCK_USER.displayName;
  if (pfName) pfName.value = curName;
  const initials  = curName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (editAvatar && !editAvatar.classList.contains('has-photo')) {
    const letter = editAvatar.querySelector('.pf-initial');
    if (letter) letter.textContent = initials;
    else {
      editAvatar.textContent = initials;
    }
    if (session?.avatarColor) editAvatar.style.background = session.avatarColor;
  }

  // Populate stats from Firebase or session
  const fb = window._lastFbProfile || window._fbUser;
  if (fb) {
    if ($('pfStatGames')) $('pfStatGames').textContent = fb.gamesPlayed ?? 0;
    if ($('pfStatWins'))  $('pfStatWins').textContent  = fb.wins ?? 0;
    if ($('pfStatCoins')) $('pfStatCoins').textContent = (fb.coins ?? 0).toLocaleString('es-AR');
  }
  refreshProfileStats();
  refreshProfileCuenta();
  if (window.ProfileAvatar?.initModal) window.ProfileAvatar.initModal();

  document.querySelectorAll('.av-color').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === session?.avatarColor);
    btn.addEventListener('click', () => {
      document.querySelectorAll('.av-color').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (editAvatar) editAvatar.style.background = btn.dataset.color;
    });
  });
}

// ── Ranking ────────────────────────────────────────────────────────────────────
// Fallback mock data shown while Firestore loads
const _RANKING_MOCK = [
  { rank:1,  name:'TrucoKing',   wins:142, games:160, xp:8520,  coins:42000, game:'truco' },
  { rank:2,  name:'CeroMaster',  wins:128, games:150, xp:7680,  coins:38500, game:'cero'  },
  { rank:3,  name:'El Gaucho',   wins:115, games:140, xp:6900,  coins:34200, game:'truco' },
  { rank:4,  name:'Maria_BA',    wins:98,  games:125, xp:5880,  coins:29100, game:'cero'  },
  { rank:5,  name:'IvanARG',     wins:87,  games:110, xp:5220,  coins:25800, game:'truco' },
  { rank:6,  name:'La Negra',    wins:76,  games:100, xp:4560,  coins:22400, game:'cero'  },
  { rank:7,  name:'PicoRoto',    wins:65,  games:90,  xp:3900,  coins:19200, game:'truco' },
  { rank:8,  name:'BillGaming',  wins:54,  games:80,  xp:3240,  coins:16100, game:'cero'  },
  { rank:9,  name:'FlorcitaRio', wins:43,  games:70,  xp:2580,  coins:12800, game:'cero'  },
  { rank:10, name:'JugadorARG',  wins:32,  games:55,  xp:1920,  coins:9500,  game:'truco' },
];

let _rankingUnsub  = null;
let _rankingGameFilter = 'all';

function _rankingSortKey(p, filterGame) {
  if (filterGame === 'cero') return p.rankPoints_cero ?? p[`wins_cero`] ?? 0;
  if (filterGame === 'truco') return p.rankPoints_truco ?? p[`wins_truco`] ?? 0;
  return p.rankPoints ?? p.xp ?? 0;
}

function _renderRankingRows(players, filterGame) {
  const list = $('rankingList');
  if (!list) return;
  list.innerHTML = '';

  let filtered = [...players];
  if (filterGame === 'cero') {
    filtered = players.filter(p => (p.games_cero ?? p.wins_cero ?? 0) > 0 || p.game === 'cero');
  } else if (filterGame === 'truco') {
    filtered = players.filter(p => (p.games_truco ?? p.wins_truco ?? 0) > 0 || p.game === 'truco');
  }

  filtered.sort((a, b) => _rankingSortKey(b, filterGame) - _rankingSortKey(a, filterGame));

  if (!filtered.length) {
    const msg = filterGame === 'cero'
      ? 'Todavía no hay partidas de CERO en el ranking. ¡Jugá una y aparecés acá!'
      : filterGame === 'truco'
        ? 'Todavía no hay partidas de Truco en el ranking.'
        : 'Sin jugadores en el ranking todavía.';
    list.innerHTML = `<p class="rk-empty">${msg}</p>`;
    return;
  }

  filtered.forEach((p, i) => {
    const rank    = i + 1;
    const el      = document.createElement('div');
    el.className  = `rk-row ${rank <= 3 ? 'rk-top' : ''}`;
    const medal   = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

    const wins    = filterGame === 'cero' ? (p.wins_cero ?? 0)
      : filterGame === 'truco' ? (p.wins_truco ?? 0)
        : (p.wins ?? 0);
    const games   = filterGame === 'cero' ? (p.games_cero ?? 0)
      : filterGame === 'truco' ? (p.games_truco ?? 0)
        : (p.gamesPlayed ?? p.games ?? 0);
    const winPct  = games > 0 ? Math.round((wins / games) * 100) : 0;
    const coins   = (p.coins || 0).toLocaleString('es-AR');
    const trophyStr = wins > 0 ? `🏆${wins}` : '';
    const rankPts = (filterGame === 'cero' ? (p.rankPoints_cero ?? 0)
      : filterGame === 'truco' ? (p.rankPoints_truco ?? 0)
        : (p.rankPoints ?? 0)).toLocaleString('es-AR');

    el.innerHTML = `
      <span class="rk-pos">${medal}</span>
      <div class="rk-name-cell">
        <span class="rk-name">${p.name || p.displayName || '???'}</span>
        ${trophyStr ? `<span class="rk-trophies">${trophyStr}</span>` : ''}
      </div>
      <div class="rk-stats">
        <span class="rk-wins"  title="Copas (victorias)">${wins}🏆</span>
        <span class="rk-pct"   title="% Victoria">${winPct}%</span>
        <span class="rk-pts"   title="Puntos ranking">${rankPts} pts</span>
        <span class="rk-coins" title="Cero Coins">◈ ${coins}</span>
      </div>`;
    list.appendChild(el);
  });
}

function renderRanking(game) {
  if (game !== undefined) _rankingGameFilter = game;

  // Bind tabs once
  document.querySelectorAll('.rk-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.rk-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderRanking(tab.dataset.game);
    };
  });

  const list = $('rankingList');
  if (!list) return;

  // Require auth for Firestore ranking (users collection is auth-gated)
  const session = _loadSessionUser();
  if (!window.FBHub || !session?.uid) {
    _renderRankingRows(_RANKING_MOCK, _rankingGameFilter);
    return;
  }

  // Real-time ranking from Firestore
  if (_rankingUnsub) _rankingUnsub();
  list.innerHTML = '<div class="rk-loading">Cargando ranking...</div>';

  const { db, collection, query, orderBy, limit: fbLimit, where, onSnapshot } = window.FBHub;
  const q = query(
    collection(db, 'users'),
    where('anon', '==', false),
    fbLimit(40)
  );

  _rankingUnsub = onSnapshot(q, snap => {
    if (snap.empty) { _renderRankingRows(_RANKING_MOCK, _rankingGameFilter); return; }
    const players = snap.docs
      .map(d => ({ ...d.data(), uid: d.id, name: d.data().displayName || d.data().name }));
    _renderRankingRows(players, _rankingGameFilter);
  }, err => {
    // If composite index isn't built yet, show mock and log the build URL
    console.warn('[Hub] Ranking index building:', err.message);
    _renderRankingRows(_RANKING_MOCK, _rankingGameFilter);
  });
}
window.renderRanking = renderRanking;

// ── Tournaments ────────────────────────────────────────────────────────────────
const _TOURNAMENTS_MOCK = [
  { id:'t1', name:'Torneo Truco Semanal',  game:'truco', players:0,  max:32, prize:50000,  date:'Sábado 24/05',  status:'open' },
  { id:'t2', name:'Copa Cero Clásico',     game:'cero',  players:12, max:16, prize:30000,  date:'Domingo 25/05', status:'open' },
  { id:'t3', name:'Gran Truco Argentino',  game:'truco', players:32, max:32, prize:100000, date:'Sábado 31/05',  status:'soon' },
];

const _T_STATUS_LABEL = {
  soon: '🔵 Próximamente',
  open: '🟢 Inscripción abierta',
  registration: '🟢 Inscripción abierta',
  live: '🔴 En curso',
  finished: '⚫ Finalizado',
};

let _hubTournamentFilter = 'upcoming';
let _hubTournamentsCache = [];

function _filterHubTournaments(list) {
  if (_hubTournamentFilter === 'live') return list.filter(t => t.status === 'live');
  if (_hubTournamentFilter === 'done') return list.filter(t => t.status === 'finished');
  return list.filter(t => ['soon', 'open', 'registration'].includes(t.status || 'open'));
}

function _renderHubBracket(t) {
  if (!t.bracket?.rounds?.length) return '';
  let html = '<div class="tc-bracket">';
  t.bracket.rounds.forEach(rd => {
    html += `<div class="tc-bracket-round"><span class="tc-br-rnd">${rd.label || 'Ronda'}</span>`;
    rd.matches.forEach(m => {
      const w = m.winnerUid;
      html += `<div class="tc-br-match">
        <span class="${w === m.p1?.uid ? 'tc-br-win' : ''}">${m.p1?.displayName || '—'}</span>
        <span class="tc-br-vs">vs</span>
        <span class="${w === m.p2?.uid ? 'tc-br-win' : ''}">${m.p2?.displayName || '—'}</span>
      </div>`;
    });
    html += '</div>';
  });
  if (t.bracket.championUid) html += '<p class="tc-br-champ">🏆 Campeón registrado</p>';
  html += '</div>';
  return html;
}

function _renderTournamentList(tournaments) {
  const list = $('tournamentsList');
  if (!list) return;
  const filtered = _filterHubTournaments(tournaments);
  list.innerHTML = '';
  if (!filtered.length) {
    list.innerHTML = '<p class="tc-empty">No hay torneos en esta pestaña.</p>';
    return;
  }
  filtered.forEach(t => {
    const el = document.createElement('div');
    el.className = `tournament-card tc-${t.game}`;
    const playerCount = t.players ?? t.registrations ?? 0;
    const st = t.status || 'open';
    const dateTxt = t.dateLabel || t.date || '—';
    const canJoin = st === 'open' || st === 'registration';
    let action = '';
    if (canJoin) {
      action = `<button class="tc-join-btn" onclick="joinTournament('${t.id}')">Inscribirme</button>`;
    } else if (st === 'live') {
      action = '<span class="tc-live-badge">Partidos en curso — seguí el bracket</span>';
    } else if (st === 'finished') {
      action = '<span class="tc-done-badge">Torneo finalizado</span>';
    } else {
      action = '<button class="tc-join-btn tc-soon-btn" disabled>Próximamente</button>';
    }
    el.innerHTML = `
      <div class="tc-header">
        <span class="tc-game-badge ${t.game}">${t.game === 'truco' ? '♠ Truco' : '★ Cero'}</span>
        <span class="tc-status ${st}">${_T_STATUS_LABEL[st] || st}</span>
      </div>
      <div class="tc-name">${t.name}</div>
      <div class="tc-meta">
        <span>📅 ${dateTxt}</span>
        <span>👥 ${playerCount}/${t.max}</span>
        <span>◈ ${(t.prize||t.prizeCC||0).toLocaleString('es-AR')} premio</span>
        ${(t.entryCC||t.entry) ? `<span>🎫 ${(t.entryCC||t.entry).toLocaleString('es-AR')} entrada</span>` : ''}
      </div>
      ${(st === 'live' || st === 'finished') ? _renderHubBracket(t) : ''}
      ${action}`;
    list.appendChild(el);
  });
}

function _bindHubTournamentTabs() {
  document.querySelectorAll('.hub-t-filter').forEach(btn => {
    if (btn._tBound) return;
    btn._tBound = true;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.hub-t-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _hubTournamentFilter = btn.dataset.hubTfilter || 'upcoming';
      _renderTournamentList(_hubTournamentsCache.length ? _hubTournamentsCache : _TOURNAMENTS_MOCK);
    });
  });
}

function renderTournaments() {
  _bindHubTournamentTabs();
  const session = _loadSessionUser();
  if (!window.FBHub || !session?.uid) {
    _hubTournamentsCache = _TOURNAMENTS_MOCK;
    _renderTournamentList(_TOURNAMENTS_MOCK);
    return;
  }

  const { db, collection, query, orderBy, onSnapshot } = window.FBHub;
  const q = query(collection(db, 'tournaments'), orderBy('date', 'asc'));
  onSnapshot(q, snap => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _hubTournamentsCache = data.length ? data : _TOURNAMENTS_MOCK;
    _renderTournamentList(_hubTournamentsCache);
  }, () => {
    _hubTournamentsCache = _TOURNAMENTS_MOCK;
    _renderTournamentList(_TOURNAMENTS_MOCK);
  });
}

async function joinTournament(id) {
  const user = _loadSessionUser();
  if (!user || user.anon) {
    closeModal('modalTournaments');
    window.location.href = 'login.html';
    return;
  }
  if (!window.FBHub) {
    alert('✅ Inscripción registrada! Te notificaremos cuando empiece el torneo.');
    return;
  }
  const { db, doc, getDoc, setDoc, serverTimestamp, increment, updateDoc, runTransaction } = window.FBHub;
  try {
    const tRef = doc(db, 'tournaments', id);
    const rRef = doc(db, 'tournaments', id, 'registrations', user.uid);
    const existing = await getDoc(rRef);
    if (existing.exists()) {
      alert('Ya estás inscripto en este torneo.');
      return;
    }

    const tSnap = await getDoc(tRef);
    if (!tSnap.exists()) {
      alert('Torneo no encontrado.');
      return;
    }
    const t = tSnap.data();
    const st = t.status || 'open';
    if (!['open', 'registration'].includes(st)) {
      alert(st === 'live' ? 'El torneo ya está en curso. No podés inscribirte.' : 'Las inscripciones están cerradas.');
      return;
    }
    const max = t.max || 32;
    const count = t.registrations ?? t.players ?? 0;
    if (count >= max) {
      alert('No quedan cupos en este torneo.');
      return;
    }
    const entry = t.entryCC || t.entry || 0;
    if (entry > 0) {
      const uRef = doc(db, 'users', user.uid);
      await runTransaction(db, async tx => {
        const uSnap = await tx.get(uRef);
        const coins = uSnap.data()?.coins ?? 0;
        if (coins < entry) throw new Error('INSUFFICIENT_COINS');
        tx.update(uRef, { coins: coins - entry });
      });
    }

    await setDoc(rRef, {
      uid: user.uid,
      displayName: user.name || user.displayName || 'Jugador',
      registeredAt: serverTimestamp(),
      entryPaid: entry,
    });
    await updateDoc(tRef, { registrations: increment(1) });
    if (window.FBHub?.refreshCoins) await window.FBHub.refreshCoins(user.uid);
    alert('✅ ¡Inscripción confirmada! Te avisamos cuando empiece el torneo.');
  } catch (e) {
    if (e.message === 'INSUFFICIENT_COINS') {
      alert(`❌ Necesitás más Cero Coins para la entrada.`);
    } else {
      alert('❌ Error al inscribirse. Intentá de nuevo.');
    }
    console.error('[Hub] joinTournament:', e);
  }
}
window.joinTournament = joinTournament;

// ── Coins transfer / redeem ────────────────────────────────────────────────────
async function transferCoins() {
  const targetName = $('transferTarget')?.value?.trim();
  const amount     = parseInt($('transferAmount')?.value || '0', 10);
  if (!targetName || amount <= 0) { alert('Completá todos los campos.'); return; }

  const user = _loadSessionUser();
  if (!user || user.anon) { alert('Debés estar registrado para transferir coins.'); return; }
  if ((user.coins ?? 0) < amount) { alert('No tenés suficientes Cero Coins.'); return; }
  if (!window.FBHub) { alert('Conectando con Firebase... Intentá en unos segundos.'); return; }

  const { db, collection, query, where: fbWhere, getDocs, doc, runTransaction, serverTimestamp } = window.FBHub;

  // Find recipient by displayName
  const q = query(collection(db, 'users'), fbWhere('displayName', '==', targetName), fbWhere('anon', '==', false));
  const snap = await getDocs(q);
  if (snap.empty) { alert(`❌ No se encontró el jugador "${targetName}".`); return; }
  const recipientDoc = snap.docs[0];
  if (recipientDoc.id === user.uid) { alert('❌ No podés transferirte coins a vos mismo.'); return; }

  try {
    await runTransaction(db, async tx => {
      const senderRef    = doc(db, 'users', user.uid);
      const recipientRef = doc(db, 'users', recipientDoc.id);
      const senderSnap   = await tx.get(senderRef);
      if (!senderSnap.exists()) throw new Error('sender_not_found');
      const currentCoins = senderSnap.data().coins ?? 0;
      if (currentCoins < amount) throw new Error('insufficient_coins');
      tx.update(senderRef,    { coins: currentCoins - amount });
      tx.update(recipientRef, { coins: (recipientDoc.data().coins ?? 0) + amount });
    });

    // Update session cache
    user.coins -= amount;
    sessionStorage.setItem('cero_user', JSON.stringify(user));
    syncCoinsUI();
    const recipientName = recipientDoc.data().displayName || targetName;
    if (window.FriendsSocial?.notifyCoins) {
      FriendsSocial.notifyCoins(recipientDoc.id, {
        type: 'coins_received',
        amount,
        counterparty: user.name || user.displayName || 'Un jugador',
      }).catch(() => {});
      FriendsSocial.notifyCoins(user.uid, {
        type: 'coins_sent',
        amount,
        counterparty: recipientName,
      }).catch(() => {});
    }
    alert(`✅ Transferiste ${amount.toLocaleString('es-AR')} ◈ a ${targetName} correctamente.`);
    $('transferTarget').value = '';
    $('transferAmount').value = '';
  } catch (e) {
    if (e.message === 'insufficient_coins') alert('❌ Coins insuficientes al momento de la transferencia.');
    else { alert('❌ Error al transferir. Intentá de nuevo.'); console.error(e); }
  }
}

async function redeemCode() {
  const code = $('redeemCode')?.value?.trim().toUpperCase();
  if (!code) { alert('Ingresá un código.'); return; }

  const user = _loadSessionUser();
  if (!user || user.anon) { alert('Debés estar registrado para canjear un código.'); return; }

  if (!window.FBHub) {
    // Offline fallback: known beta code
    if (code === 'CERO-BETA-2025') alert('🎉 ¡Código válido! +500 Cero Coins (se acreditarán al conectar).');
    else alert('❌ Código inválido o ya usado.');
    return;
  }

  const { db, doc, getDoc, updateDoc, setDoc, serverTimestamp, increment: fbIncr } = window.FBHub;
  const codeRef = doc(db, 'codes', code);
  const codeSnap = await getDoc(codeRef);

  if (!codeSnap.exists()) { alert('❌ Código inválido.'); return; }
  const codeData = codeSnap.data();
  if (codeData.usedBy?.includes(user.uid)) { alert('❌ Ya usaste este código.'); return; }
  if (codeData.usedCount >= (codeData.maxUses ?? Infinity)) { alert('❌ Este código ya alcanzó el límite de usos.'); return; }

  const reward = codeData.coins ?? 500;
  try {
    await updateDoc(codeRef, {
      usedBy:    [...(codeData.usedBy ?? []), user.uid],
      usedCount: fbIncr(1),
    });
    await updateDoc(doc(db, 'users', user.uid), { coins: fbIncr(reward) });

    user.coins = (user.coins ?? 0) + reward;
    sessionStorage.setItem('cero_user', JSON.stringify(user));
    syncCoinsUI();
    if (window.FriendsSocial?.notifyCoins) {
      FriendsSocial.notifyCoins(user.uid, {
        type: 'coins_redeem',
        amount: reward,
        code,
      }).catch(() => {});
    }
    alert(`🎉 ¡Código válido! +${reward.toLocaleString('es-AR')} Cero Coins acreditados.`);
    $('redeemCode').value = '';
  } catch (e) {
    alert('❌ Error al canjear el código. Intentá de nuevo.');
    console.error(e);
  }
}
window.transferCoins = transferCoins;
window.redeemCode    = redeemCode;

// ── TIENDA (STORE) ─────────────────────────────────────────────────────────────
const _STORE_ITEMS = {
  cards: [
    {
      id:'skin-classic', name:'Skill Classic',
      desc:'Naipe español auténtico (40 cartas Truco, sin 8 ni 9). Fondo blanco crema con logo CERO en marca de agua al centro.',
      price:0, cat:'cards', icon:'🃏', games:'ambos', tag:'GRATIS', skin:'skin-classic'
    },
    {
      id:'skin-dark-arena', name:'Dark Arena',
      desc:'Cartas oscuras #121212 con bordes neón: celeste en Espada/Basto y rosa en Oro/Copa. Logo CERO brillante en el centro.',
      price:900, cat:'cards', icon:'🌑', games:'ambos', tag:'POPULAR', skin:'skin-dark-arena'
    },
    {
      id:'skin-hacker', name:'Hacker Edition',
      desc:'Cartas oscuras en negro absoluto. Símbolos en verde Matrix brillante. Efecto scanline cyberpunk sobre el tapete.',
      price:500, cat:'cards', icon:'💻', games:'ambos', tag:'POPULAR', skin:'skin-hacker'
    },
    {
      id:'skin-neon', name:'Neon Prime ★',
      desc:'Los palos brillan como hologramas. Cada palo tiene su propio color neón pulsante. La skin más exclusiva de la mesa.',
      price:1200, cat:'cards', icon:'✨', games:'ambos', tag:'PREMIUM', skin:'skin-neon'
    },
    {
      id:'card_arg', name:'Argentina 78 🇦🇷',
      desc:'Diseño especial de la copa del mundo del 78. Incluye escudo argentino en el reverso.',
      price:1500, cat:'cards', icon:'🏆', games:'truco', tag:'EXCLUSIVO'
    },
    {
      id:'card_vintage', name:'Vintage 1920',
      desc:'Diseño art déco de los años 20. Las cartas usadas en los primeros torneos.',
      price:1500, cat:'cards', icon:'🎭', games:'ambos', tag:''
    },
    {
      id:'card_madera', name:'Madera Tallada',
      desc:'Textura de madera tallada con motivos criollos. El mazo de la pulpería argentina.',
      price:2500, cat:'cards', icon:'🪵', games:'truco', tag:''
    },
    {
      id:'card_hologram', name:'Holográfico ★',
      desc:'Efecto iridiscente exclusivo. Solo 100 unidades disponibles. Ultra limitado.',
      price:5000, cat:'cards', icon:'🌈', games:'ambos', tag:'RARO'
    },
  ],
  tables: [
    { id:'table_classic', name:'Fieltro Verde',      desc:'La mesa clásica de los grandes torneos.',       price:0,    cat:'tables', icon:'🟩', games:'ambos' },
    { id:'table_madera',  name:'Madera Rústica',     desc:'Mesa de roble con textura natural.',            price:600,  cat:'tables', icon:'🪵', games:'ambos' },
    { id:'table_dark',    name:'Dark Arena Pro',     desc:'Mesa oscura con bordes de luz de neón.',        price:1200, cat:'tables', icon:'🌑', games:'ambos' },
    { id:'table_cuero',   name:'Cuero Premium',      desc:'Tapizado de cuero negro con costuras doradas.', price:2000, cat:'tables', icon:'⚫', games:'ambos' },
    { id:'table_marmol',  name:'Mármol Dorado',      desc:'Mesa de mármol blanco con venas doradas.',      price:3500, cat:'tables', icon:'🏛',  games:'ambos' },
    { id:'table_oro',     name:'Marco Oro ★',        desc:'Borde dorado premium estilo casino UNO.',       price:2800, cat:'tables', icon:'🥇', games:'ambos', tag:'PREMIUM' },
    { id:'table_living',  name:'Living Premium',     desc:'Fondo living con sillones y luz cálida.',       price:3200, cat:'tables', icon:'🛋', games:'cero', tag:'NUEVO' },
  ],
  avatars: [
    { id:'av_gaucho',     name:'El Gaucho',          desc:'Ícono clásico del jugador argentino.',          price:300,  cat:'avatars', icon:'🤠', games:'ambos' },
    { id:'av_maga',       name:'La Maga',            desc:'La jugadora misteriosa con sombrero.',          price:300,  cat:'avatars', icon:'🧙‍♀️', games:'ambos' },
    { id:'av_espadas',    name:'As de Espadas',      desc:'El ancho de espadas como avatar.',              price:400,  cat:'avatars', icon:'⚔', games:'truco' },
    { id:'av_comodin',    name:'El Comodín',         desc:'La carta comodín hecha avatar.',               price:350,  cat:'avatars', icon:'🃏', games:'cero' },
    { id:'av_corona',     name:'Corona Real',        desc:'Para los campeones de la comunidad.',           price:500,  cat:'avatars', icon:'👑', games:'ambos' },
    { id:'av_dragon',     name:'Dragón Cero',        desc:'El legendario dragón del Cero Club.',           price:2500, cat:'avatars', icon:'🐉', games:'ambos' },
  ],
  emotes: [
    { id:'emo_basico',    name:'Pack Básico',        desc:'5 emotes esenciales para el chat.',             price:0,    cat:'emotes', icon:'😊', games:'ambos' },
    { id:'emo_bsas',      name:'Pack Buenos Aires',  desc:'¡Dale!, ¡Re bien!, ¡Qué poroto!, y más.',      price:200,  cat:'emotes', icon:'🏙', games:'ambos' },
    { id:'emo_truco',     name:'Pack Truco Pro',     desc:'¡Mato!, ¡Envido va!, ¡Truco mentiroso!, etc.', price:300,  cat:'emotes', icon:'♠', games:'truco' },
    { id:'emo_cero',      name:'Pack Cero Supremo',  desc:'¡CERO!, ¡+4 te mando!, ¡Cambio de color!, etc.',price:300, cat:'emotes', icon:'★', games:'cero'  },
    { id:'emo_argentina', name:'Pack Argentina 🇦🇷', desc:'Expresiones típicas del juego argentino.',     price:400,  cat:'emotes', icon:'🇦🇷', games:'ambos' },
  ],
  unlocks: [
    { id:'unlock_tomato', name:'Tomate lanzable', desc:'Item sanos para tirar al rival en la mesa.', price:0, priceRank:120, cat:'unlocks', icon:'🍅', games:'cero' },
    { id:'unlock_egg',    name:'Huevo lanzable',  desc:'Burla amistosa en partida CERO.',           price:0, priceRank:80,  cat:'unlocks', icon:'🥚', games:'cero' },
    { id:'unlock_crown',  name:'Corona victoria', desc:'Celebrá cuando ganás.',                    price:0, priceRank:200, cat:'unlocks', icon:'👑', games:'ambos' },
    { id:'unlock_fire',   name:'Fuego racha',     desc:'Mostrá que vas en racha.',                 price:0, priceRank:150, cat:'unlocks', icon:'🔥', games:'ambos' },
    { id:'unlock_cc',     name:'Flex CC',         desc:'Icono ◈ para burla sana al ganar.',          price:0, priceRank:100, cat:'unlocks', icon:'◈', games:'ambos' },
  ],
  boost: [
    { id:'boost_2x3',     name:'x2 Coins · 3 días', desc:'Ganás el doble de Cero Coins por 3 días.',      price:500,  cat:'boost', icon:'💰', games:'ambos' },
    { id:'boost_2x7',     name:'x2 Coins · 7 días', desc:'Ganás el doble de Cero Coins por 7 días.',      price:1000, cat:'boost', icon:'💰', games:'ambos' },
    { id:'boost_3x7',     name:'x3 Coins · 7 días', desc:'¡Triple de ganancias por una semana!',          price:2500, cat:'boost', icon:'💎', games:'ambos' },
    { id:'boost_xp2',     name:'x2 XP · 3 días',    desc:'Subís de nivel el doble de rápido.',            price:400,  cat:'boost', icon:'⚡', games:'ambos' },
    { id:'boost_refill',  name:'Recarga de Coins',   desc:'Recibí 500 Cero Coins extra hoy.',              price:0,    cat:'boost', icon:'🎁', games:'ambos', daily:true },
  ],
};

// ── Store helpers (localStorage cache + Firestore sync) ────────────────────────
const _DEFAULT_OWNED    = ['skin-classic','table_classic','emo_basico','boost_refill'];
const _DEFAULT_EQUIPPED = {};

function _getOwned()          { try { return JSON.parse(localStorage.getItem('cero_owned')    || JSON.stringify(_DEFAULT_OWNED));    } catch(_) { return [..._DEFAULT_OWNED];    } }
function _setOwned(list)      { localStorage.setItem('cero_owned',    JSON.stringify(list)); }
function _getEquipped()       { try { return JSON.parse(localStorage.getItem('cero_equipped') || '{}'); } catch(_) { return {}; } }
function _setEquipped(map)    { localStorage.setItem('cero_equipped',  JSON.stringify(map));  }

// Sync owned/equipped from Firestore when profile loads
async function _syncStoreFromFirestore(uid) {
  if (!window.FBHub) return;
  const { db, doc, getDoc } = window.FBHub;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.ownedItems)    _setOwned(data.ownedItems);
    if (data.equippedItems) _setEquipped(data.equippedItems);
  } catch (_) {}
}

let _storeCat = 'cards';

function renderStore(cat) {
  _storeCat = cat || _storeCat;
  const grid    = $('storeGrid');
  const coinsEl = $('storeCoins');
  if (!grid) return;

  // Get current coins from session (updated by Firebase in real time)
  const session  = _loadSessionUser();
  const coins    = session?.coins ?? MOCK_USER.coins ?? 0;
  const rankPts  = session?.rankPoints ?? session?.xp ?? 0;
  if (coinsEl) coinsEl.textContent = coins.toLocaleString('es-AR');
  const ptsEl = document.getElementById('storeRankPts');
  if (ptsEl) ptsEl.textContent = rankPts.toLocaleString('es-AR');

  const owned    = _getOwned();
  const equipped = _getEquipped();
  const items    = _STORE_ITEMS[_storeCat] || [];

  grid.innerHTML = '';
  items.forEach(item => {
    const isOwned    = owned.includes(item.id);
    const isEquipped = equipped[item.cat] === item.id;
    const useRank    = (item.priceRank || 0) > 0 && item.price === 0;
    const canAfford  = useRank ? rankPts >= item.priceRank : coins >= item.price;
    const isFree     = item.price === 0 && !item.priceRank;

    const el = document.createElement('div');
    el.className = `store-item${isOwned ? ' si-owned' : ''}${isEquipped ? ' si-equipped' : ''}`;

    let actionBtn;
    if (isEquipped) {
      actionBtn = `<button class="si-btn si-equip-active" disabled>✔ Equipado</button>`;
    } else if (isOwned) {
      actionBtn = `<button class="si-btn si-equip" onclick="equipItem('${item.id}','${item.cat}')">Equipar</button>`;
    } else if (isFree) {
      actionBtn = `<button class="si-btn si-free" onclick="buyItem('${item.id}')">Gratis</button>`;
    } else if (canAfford) {
      actionBtn = useRank
        ? `<button class="si-btn si-buy" onclick="buyItem('${item.id}')">${item.priceRank} pts</button>`
        : `<button class="si-btn si-buy" onclick="buyItem('${item.id}')">◈ ${item.price.toLocaleString('es-AR')}</button>`;
    } else {
      actionBtn = useRank
        ? `<button class="si-btn si-locked" disabled>${item.priceRank} pts</button>`
        : `<button class="si-btn si-locked" disabled title="No tenés suficientes coins">◈ ${item.price.toLocaleString('es-AR')}</button>`;
    }

    const gameBadge = item.games !== 'ambos'
      ? `<span class="si-game-badge si-${item.games}">${item.games === 'truco' ? '♠ Truco' : '★ Cero'}</span>` : '';
    const tagBadge  = item.tag
      ? `<span class="si-tag-badge">${item.tag}</span>` : '';

    const cardPreview = item.skin
      ? `<div class="si-card-preview ${item.skin}" aria-hidden="true"></div>`
      : `<div class="si-icon">${item.icon}</div>`;

    el.innerHTML = `
      ${cardPreview}
      <div class="si-body">
        <div class="si-name-row">
          <span class="si-name">${item.name}</span>
          ${gameBadge}${tagBadge}
        </div>
        <div class="si-desc">${item.desc}</div>
      </div>
      <div class="si-action">${actionBtn}</div>`;
    grid.appendChild(el);
  });

  // Tab bindings (idempotent)
  document.querySelectorAll('.store-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.store-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderStore(tab.dataset.cat);
    };
  });
}

async function buyItem(id) {
  const allItems = Object.values(_STORE_ITEMS).flat();
  const item     = allItems.find(i => i.id === id);
  if (!item) return;

  const owned = _getOwned();
  if (owned.includes(id)) { equipItem(id, item.cat); return; }

  const session = _loadSessionUser();
  const coins   = session?.coins ?? 0;
  const rankPts = session?.rankPoints ?? session?.xp ?? 0;
  const useRank = (item.priceRank || 0) > 0 && item.price === 0;

  if (useRank && rankPts < item.priceRank) {
    alert('❌ No tenés suficientes puntos de ranking.');
    return;
  }
  if (!useRank && item.price > 0 && coins < item.price) {
    alert('❌ No tenés suficientes Cero Coins.');
    return;
  }

  if (session) {
    if (useRank) session.rankPoints = rankPts - item.priceRank;
    else session.coins = coins - item.price;
    sessionStorage.setItem('cero_user', JSON.stringify(session));
  }
  if (MOCK_USER) {
    if (useRank) MOCK_USER.rankPoints = rankPts - item.priceRank;
    else MOCK_USER.coins = coins - item.price;
  }
  syncCoinsUI();

  owned.push(id);
  _setOwned(owned);
  equipItem(id, item.cat);

  if (window.FBHub && session?.uid) {
    const { db, doc, updateDoc, increment: fbIncr } = window.FBHub;
    try {
      const patch = { ownedItems: owned };
      if (useRank) patch.rankPoints = fbIncr(-item.priceRank);
      else if (item.price > 0) patch.coins = fbIncr(-item.price);
      await updateDoc(doc(db, 'users', session.uid), patch);
    } catch (e) { console.warn('[Hub] buyItem Firestore sync error:', e); }
  }
}
window.buyItem = buyItem;

async function equipItem(id, cat) {
  const equipped = _getEquipped();
  equipped[cat]  = id;
  _setEquipped(equipped);

  if (cat === 'cards') {
    const item = (_STORE_ITEMS.cards || []).find(i => i.id === id);
    if (item?.skin) {
      localStorage.setItem('truco_skin', item.skin);
      if (typeof window.applyTrucoCardSkin === 'function') {
        window.applyTrucoCardSkin(item.skin);
      }
    }
  }

  renderStore();

  // Sync to Firestore
  const session = _loadSessionUser();
  if (window.FBHub && session?.uid) {
    const { db, doc, updateDoc } = window.FBHub;
    try {
      await updateDoc(doc(db, 'users', session.uid), { equippedItems: equipped });
    } catch (_) {}
  }
}
window.equipItem = equipItem;

// ── Init live rooms ────────────────────────────────────────────────────────────
function initLiveRooms() {
  const grid = document.getElementById('liveRoomsGrid');
  if (grid) grid.innerHTML = '<p class="lr-connecting">Conectando en tiempo real...</p>';

  renderRanking();
  renderTournaments();
  _initProfileModal();
  renderStore('cards');

  if (window.FBHub?.db) renderLiveRooms();

  setTimeout(() => {
    if (!window.FBHub?.db) {
      const g = document.getElementById('liveRoomsGrid');
      if (g) g.innerHTML = '<p class="lr-empty">Sin conexión a Firebase. Recargá la página (Ctrl+F5).</p>';
    }
  }, 12000);
}

// ── Expose to HTML onclick attributes ─────────────────────────────────────────
window.openRoomModal    = openRoomModal;
window.closeRoomModal   = closeRoomModal;
window.launchGame       = launchGame;
window.joinRoom         = joinRoom;
window.Scorer           = Scorer;
window.spectateRoom     = spectateRoom;
window.startQuickPlay   = startQuickPlay;
window.playNowPick = playNowPick;
window.cancelQuickPlay  = cancelQuickPlay;
window.joinQuickRoom    = joinQuickRoom;
window.enterMyRoom      = enterMyRoom;
window.closeMyRoom      = closeMyRoom;
window.openAbandonModal = openAbandonModal;
window.confirmAbandonRoom = confirmAbandonRoom;
