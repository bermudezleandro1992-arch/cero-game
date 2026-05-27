'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  if (window.FBHub?.setActiveGame) window.FBHub.setActiveGame('cero');

  const params   = new URLSearchParams(location.search);
  const roomId   = params.get('roomId');
  const myUid    = params.get('uid');
  const isOnline = !!roomId;

  const opts = getUrlOpts();

  const modeEl = document.getElementById('gameMode');
  if (modeEl) modeEl.textContent = opts.mode === 'cero' ? 'Modo Cero ★' : 'Clásico';

  const playersEl = document.getElementById('playerCountLabel');
  if (playersEl) {
    playersEl.textContent = isOnline
      ? `Online · ${opts.format || '1v1'}`
      : `${opts.players} jugadores`;
  }

  const formatEl = document.getElementById('gameFormatLabel');
  if (formatEl) {
    const labels = { '1v1': '1 vs 1', '2v2': '2 vs 2', '3v3': '3 vs 3' };
    formatEl.textContent = labels[opts.format] || opts.format || '1 vs 1';
  }

  if (window.CeroTableSkins) CeroTableSkins.apply();
  if (window.CeroDrag) CeroDrag.init();
  _renderCardsGuide();

  if (isOnline) {
    const authUid = await _waitFirebaseAuth(20000);
    if (!authUid) {
      _showError('Sin conexión con Firebase. Recargá el lobby (F5) e intentá de nuevo.');
      return;
    }
    if (myUid && myUid !== authUid) {
      console.warn('[Cero] URL uid distinto a sesión; usando sesión activa.');
    }
    const effectiveUid = authUid;

    if (window.CeroChat) {
      CeroChat.init({ roomId, uid: effectiveUid, name: _playerDisplayName() });
    }
    if (window.CeroThrows) {
      CeroThrows.init({ roomId, uid: effectiveUid });
    }

    const colyseusRoom = window.CeroColyseus
      ? await CeroColyseus.tryConnect({ ...opts, uid: effectiveUid, name: _playerDisplayName() })
      : null;

    if (colyseusRoom) {
      _showError('Modo Colyseus activo en desarrollo. Usá partida rápida del lobby (Firebase).');
      return;
    }

    const game = new CeroOnlineGame(roomId, effectiveUid, opts, (state) => {
      try {
        renderCeroOnline(state, game);
      } catch (err) {
        console.error('[Cero render online]', err);
        _showError(err?.message || 'Error al dibujar la mesa.');
      }
    });

    _showWaitingRoom();

    try {
      if (window.RoomLifecycle?.canRejoin) {
        const ok = await RoomLifecycle.canRejoin(roomId, effectiveUid);
        if (ok) await RoomLifecycle.clearLeft(roomId, effectiveUid);
      }
      await game.init();
      if (window.CeroTurnTimer) CeroTurnTimer.bind(game);
      if (window.RoomLifecycle) RoomLifecycle.bindUnload(roomId, 'cero', effectiveUid);
    } catch (err) {
      _showError(err.message || 'Error al conectar con la sala');
      return;
    }

    window.addEventListener('pagehide', () => {
      game.destroy({ skipLeave: true });
      if (window.CeroChat) CeroChat.destroy();
      if (window.FBHub?.setActiveGame) window.FBHub.setActiveGame('hub');
    });

    _bindMute(game);
    _bindAbandon(roomId, effectiveUid);
    _bindMobileHud(true);
    window._ceroGame = game;
    window.denunciar_no_dijo_cero = () => game.denunciarNoDijoCero?.();
    return;
  }

  if (window.CeroChat) {
    CeroChat.init({ roomId: null, uid: myUid || 'local', name: _playerDisplayName() });
  }
  if (window.CeroThrows) {
    CeroThrows.init({ roomId: null, uid: myUid });
  }

  try {
    if (typeof createCeroDeck !== 'function' || typeof CeroGame !== 'function') {
      throw new Error('No se cargó el motor del juego. Recargá con Ctrl+F5.');
    }
    if (!window.G_PHASE || !window.COLORS) {
      throw new Error('Faltan datos del juego. Recargá con Ctrl+F5.');
    }

    const game = new CeroGame(opts, (state) => {
      try {
        renderCero(state, game);
      } catch (err) {
        console.error('[Cero render]', err);
        _showError(err?.message || 'Error al dibujar la mesa.');
      }
    });

    if (window.CeroTurnTimer) CeroTurnTimer.bind(game);
    _bindMute(game);
    _bindMobileHud(false);
    window._ceroGame = game;
  } catch (err) {
    console.error('[Cero init]', err);
    _showError(err.message || 'No se pudo iniciar Cero');
  }
});

function _renderCardsGuide() {
  const el = document.getElementById('cardsGuideList');
  const guide = window.CARD_GUIDE;
  if (!el || !guide) return;
  const opts = typeof getUrlOpts === 'function' ? getUrlOpts() : { mode: 'classic' };
  const keys = opts.mode === 'cero'
    ? ['draw2', 'wild4', 'skip', 'reverse', 'wild', 'cero_star']
    : ['draw2', 'wild4', 'skip', 'reverse', 'wild'];
  const panel = document.querySelector('.cards-guide-panel');
  if (panel) panel.hidden = opts.mode !== 'cero';
  el.innerHTML = keys.map(k => {
    const g = guide[k];
    if (!g) return '';
    return `<p class="cg-row"><strong>${g.name}</strong><br><span>${g.desc}</span></p>`;
  }).join('');
}

async function _waitFirebaseAuth(maxMs = 20000) {
  const step = 80;
  let waited = 0;
  const check = () => window.FBHub?.db && window.FBHub?.auth?.currentUser?.uid;

  if (check()) return window.FBHub.auth.currentUser.uid;

  return new Promise(resolve => {
    const onReady = () => {
      if (check()) {
        window.removeEventListener('fb:hubReady', onReady);
        resolve(window.FBHub.auth.currentUser.uid);
      }
    };
    window.addEventListener('fb:hubReady', onReady);

    const tick = setInterval(() => {
      waited += step;
      if (check()) {
        clearInterval(tick);
        window.removeEventListener('fb:hubReady', onReady);
        resolve(window.FBHub.auth.currentUser.uid);
      } else if (waited >= maxMs) {
        clearInterval(tick);
        window.removeEventListener('fb:hubReady', onReady);
        resolve(null);
      }
    }, step);
  });
}

function _playerDisplayName() {
  try {
    const u = JSON.parse(sessionStorage.getItem('cero_user') || '{}');
    return u.displayName || u.name || 'Vos';
  } catch (_) {
    return 'Vos';
  }
}

function _bindMute(game) {
  const muteBtn = document.getElementById('muteBtn');
  if (!muteBtn || !game) return;
  muteBtn.addEventListener('click', () => {
    const on = game.toggleMute();
    muteBtn.textContent = on ? '🔊' : '🔇';
    muteBtn.title = on ? 'Silenciar' : 'Activar voz';
  });
}

function _bindMobileHud(isOnline) {
  const hud = document.getElementById('mobileHud');
  const btn = document.getElementById('ceroSidebarBtn');
  const sidebar = document.querySelector('.cero-sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (hud) hud.setAttribute('aria-hidden', isOnline ? 'false' : 'true');
  if (btn) btn.style.display = isOnline ? '' : 'none';

  if (btn?.dataset.bound === '1') return;
  if (btn) btn.dataset.bound = '1';

  const close = () => {
    sidebar?.classList.remove('sidebar-open');
    overlay?.classList.remove('active');
    overlay?.setAttribute('aria-hidden', 'true');
  };

  btn?.addEventListener('click', () => {
    const open = sidebar?.classList.toggle('sidebar-open');
    overlay?.classList.toggle('active', !!open);
    overlay?.setAttribute('aria-hidden', open ? 'false' : 'true');
  });
  overlay?.addEventListener('click', close);
}

function _bindAbandon(roomId, myUid) {
  const btn = document.getElementById('ceroAbandonBtn');
  if (!btn || !roomId || !myUid) return;
  btn.hidden = false;
  btn.addEventListener('click', async () => {
    const fb = window.FBHub;
    if (!fb?.db) return;
    let rivalName = 'tu rival';
    let potMsg = '';
    try {
      const snap = await fb.getDoc(fb.doc(fb.db, 'rooms', roomId));
      const d = snap.data() || {};
      const rival = (d.players || []).find(p => p.uid !== myUid);
      rivalName = rival?.name || rivalName;
      const stake = d.stakeCC || 0;
      const paid = (d.stakesPaid || []).length;
      if (stake > 0 && paid > 0) {
        potMsg = `\n\nPozo: ◈ ${(stake * paid).toLocaleString('es-AR')} CC. ${rivalName} se quedará con el premio.`;
      }
    } catch (_) { /* ignore */ }

    const ok = confirm(
      `¿Abandonar la partida?\n\n${rivalName} ganará por abandono.${potMsg}\n\nEsta acción no se puede deshacer.`
    );
    if (!ok) return;

    try {
      if (window.RoomLifecycle) {
        await RoomLifecycle.leave(roomId, 'cero', myUid, { force: true });
      }
      if (window.RoomPrizes?.settle) await RoomPrizes.settle(roomId);
      window._ceroGame?.destroy?.();
      window.location.href = '/';
    } catch (e) {
      alert(e.message || 'No se pudo abandonar');
    }
  });
}

function _showWaitingRoom() {
  const area = document.getElementById('ceroTable');
  if (!area || area.querySelector('.online-waiting-room')) return;
  const overlay = document.createElement('div');
  overlay.className = 'online-waiting-room online-waiting-overlay';
  overlay.innerHTML = `
      <div class="owr-logo">CERO</div>
      <div class="owr-spinner"></div>
      <div class="owr-msg" id="owrMsg">Conectando con la sala...</div>
      <button type="button" class="owr-deal-btn" id="owrDealBtn" style="display:none">Repartir cartas</button>
      <a href="/" class="owr-back">← Volver al lobby</a>`;
  area.appendChild(overlay);
}

function _showError(msg) {
  const area = document.getElementById('ceroTable');
  if (!area) return;
  const safe = String(msg).replace(/</g, '&lt;');
  area.innerHTML = `
    <div class="online-waiting-room online-error">
      <div class="owr-logo">!</div>
      <div class="owr-msg">${safe}</div>
      <a href="/" class="owr-back">← Volver al lobby</a>
    </div>`;
}
