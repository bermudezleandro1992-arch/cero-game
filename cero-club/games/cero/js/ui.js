'use strict';

var _CERO_PHASE_FALLBACK = {
  DEALING: 'DEALING', PLAYER_TURN: 'PLAYER_TURN', CPU_TURN: 'CPU_TURN',
  COLOR_PICK: 'COLOR_PICK', SWAP_PICK: 'SWAP_PICK', MIRROR_WAIT: 'MIRROR_WAIT',
  CERO_CHANCE: 'CERO_CHANCE', GAME_OVER: 'GAME_OVER',
};
function G() {
  return window.G_PHASE || _CERO_PHASE_FALLBACK;
}
function _colorCss() {
  return window.COLOR_CSS || {};
}

function _ceroSaidHas(state, playerIdx) {
  const cs = state?.ceroSaid;
  if (!cs) return false;
  if (Array.isArray(cs)) return cs.includes(playerIdx);
  if (typeof cs.has === 'function') return cs.has(playerIdx);
  return false;
}

// ── Card HTML ──────────────────────────────────────────────────────────────────
function buildCeroCard(card, { faceDown = false, playable = false, small = false } = {}) {
  const el = document.createElement('div');
  const sz = small ? 'card-sm' : '';

  if (faceDown || !card) {
    el.className = `cero-card card-back ${sz}`;
    el.innerHTML = `
      <div class="back-corner tl"></div>
      <div class="back-corner tr"></div>
      <div class="back-logo">CERO</div>
      <div class="back-corner bl"></div>
      <div class="back-corner br"></div>`;
    return el;
  }

  const palette = _colorCss();
  const css = palette[card.color] || palette.wild || {};
  const val = cardDisplayValue(card);
  const isW = isWild(card);

  el.className = `cero-card card-${card.color} ${sz} ${playable ? 'card-playable' : ''} ${isW ? 'card-wild-type' : ''}`;
  el.style.cssText = `--cb:${css.cb};--cc:${css.cc};--cg:${css.cg}`;
  el.dataset.cardId = card.id;

  el.innerHTML = `
    <div class="card-corner top-l">
      <span class="c-n">${val}</span>
    </div>
    <div class="card-center-val">${val}</div>
    <div class="card-corner bot-r">
      <span class="c-n">${val}</span>
    </div>`;

  return el;
}

// ── Player seat positions around oval table ────────────────────────────────────
function getSeatPositions(count) {
  // Player 0 always at bottom center (270°)
  const positions = [];
  for (let i = 0; i < count; i++) {
    const deg = (270 + i * (360 / count) + 360) % 360;
    const rad = (deg * Math.PI) / 180;
    positions.push({
      x:   50 + 38 * Math.cos(rad),
      y:   50 + 32 * Math.sin(rad),
      deg,
    });
  }
  return positions;
}

// ── Main render ────────────────────────────────────────────────────────────────
function renderCero(state, game) {
  if (!state) return;
  _renderTable(state, game);
  _renderDiscard(state);
  _renderDeckArea(state, game);
  _renderColorIndicator(state);
  _renderPlayerHand(state, game);
  _renderCpuSeats(state);
  _renderActions(state, game);
  _renderStatus(state);
  _renderDrawStack(state);
  _renderScoreboard(state);
  _renderMySeatLabel(state);
  _syncClassicGuidePanel(state);
  if (window.CeroTurnTimer) CeroTurnTimer.sync(state);
}

// ── Table / seating ───────────────────────────────────────────────────────────
function _renderTable(state, game) {
  const table = document.getElementById('ceroTable');
  if (!table) return;
  table.dataset.players = state.playerCount;
  table.dataset.current = state.current;
}

function _renderCpuSeats(state) {
  const wrap = document.getElementById('cpuSeats');
  if (!wrap) return;
  wrap.innerHTML = '';

  const count = Math.min(6, Math.max(2, state.playerCount || 2));
  const positions = getSeatPositions(count);

  for (let i = 1; i < count; i++) {
    const pos   = positions[i];
    const hand  = (state.realHands && state.realHands[i]) || [];
    const isTurn = state.current === i;

    const seat = document.createElement('div');
    seat.className = `cpu-seat${isTurn ? ' seat-active' : ''}`;
    seat.style.cssText = `left:${pos.x}%;top:${pos.y}%;`;

    // Mini card count display
    const name = (state.playerNames && state.playerNames[i]) || `CPU ${i}`;
    const team = state.teams ? state.teams[i] : null;
    const myTeam = state.myTeam ?? state.teams?.[0];
    const isAlly = team !== null && team === myTeam;
    const teamBanner = team !== null
      ? `<div class="team-banner team-${team}${isAlly ? ' team-ally' : ' team-foe'}">${team === 0 ? 'EQUIPO A' : 'EQUIPO B'}</div>`
      : '';
    const scoreKey = state.teams ? `team${team}` : `p${i}`;
    const pts = state.matchScore?.[scoreKey] ?? 0;

    if (isAlly) seat.classList.add('seat-ally');

    seat.innerHTML = `
      ${teamBanner}
      <div class="cpu-avatar ${isTurn ? 'cpu-thinking' : ''}">
        <span class="seat-name">${name}</span>
      </div>
      <div class="seat-score">${pts} pts</div>
      <div class="cpu-card-count">
        ${hand.length <= 5
          ? hand.map(() => `<div class="cpu-mini-card"></div>`).join('')
          : `<div class="cpu-mini-card"></div><span class="cpu-count-badge">×${hand.length}</span>`}
      </div>
      ${hand.length === 1 ? '<div class="cero-badge">CERO!</div>' : ''}`;

    wrap.appendChild(seat);
  }
}

// ── Discard pile ──────────────────────────────────────────────────────────────
function _renderDiscard(state) {
  const el = document.getElementById('discardPile');
  if (!el) return;
  el.innerHTML = '';
  const pile = state.discard || [];
  const top = pile[pile.length - 1];
  if (top) {
    const cardEl = buildCeroCard(top, { small: true });
    cardEl.style.cssText = 'position:relative;z-index:10';
    el.appendChild(cardEl);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'discard-empty';
    placeholder.textContent = '—';
    el.appendChild(placeholder);
  }
}

// ── Deck ──────────────────────────────────────────────────────────────────────
function _renderDeckArea(state, game) {
  const el = document.getElementById('deckPile');
  if (!el) return;
  el.innerHTML = '';
  // Show 3 stacked card backs for deck
  const deckLen = (state.deck || []).length;
  for (let i = 0; i < Math.min(3, deckLen); i++) {
    const back = buildCeroCard(null, { faceDown: true, small: true });
    back.style.cssText = `position:absolute;top:${-i * 2}px;left:${-i * 1}px;z-index:${i}`;
    el.appendChild(back);
  }
  if (state.phase === G().PLAYER_TURN && state.current === 0) {
    el.classList.add('deck-active');
    el.onclick = () => game.playerDraw();
  } else {
    el.classList.remove('deck-active');
    el.onclick = null;
  }
}

function _isCeroMode(state) {
  const m = state?.mode;
  if (m) return m === 'cero';
  try {
    return (typeof getUrlOpts === 'function' ? getUrlOpts().mode : '') === 'cero';
  } catch (_) {
    return false;
  }
}

function _syncClassicGuidePanel(state) {
  const panel = document.querySelector('.cards-guide-panel');
  if (!panel) return;
  panel.hidden = !_isCeroMode(state);
}

// ── Color activo (UNO): visible online y en modo Cero ───────────────────────
function _renderColorIndicator(state) {
  const divider = document.querySelector('.center-divider');
  const showWheel = _isCeroMode(state) || !!state._online;
  if (divider) divider.hidden = !showWheel;

  const el = document.getElementById('colorIndicator');
  if (!el) return;
  if (!showWheel) {
    el.style.cssText = 'display:none';
    return;
  }
  el.style.display = '';
  const top = state.discard?.[state.discard.length - 1];
  const active = (typeof activeColor === 'function')
    ? activeColor(top, state.color)
    : state.color;
  if (!active) {
    el.style.cssText = 'opacity:.25;background:#111;border-color:#333';
    return;
  }
  const css = _colorCss()[active] || {};
  el.style.cssText = `background:${css.cb || '#111'};border-color:${css.cc || '#555'};box-shadow:0 0 12px ${css.cg || 'transparent'}`;
  el.title = `Color en juego: ${css.label || active}`;
}

// ── Player hand (estilo UNO) ──────────────────────────────────────────────────
function _sortHandCards(cards, isMyTurn, canPlayFn) {
  if (!isMyTurn || !canPlayFn) return cards;
  const bad = [];
  const good = [];
  cards.forEach(c => (canPlayFn(c) ? good : bad).push(c));
  return [...bad, ...good];
}

function _appendHandCard(handEl, card, { isMyTurn, canPlay, hint }) {
  const cardEl = buildCeroCard(card, { playable: canPlay });
  if (isMyTurn && !canPlay) cardEl.classList.add('card-unplayable');
  if (canPlay) cardEl.classList.add('card-playable', 'card-draggable');
  if (hint && isMyTurn && !canPlay) {
    cardEl.title = hint;
    cardEl.dataset.hint = hint;
  }
  handEl.appendChild(cardEl);
  return cardEl;
}

function _finishHandRender(handEl, isMyTurn) {
  if (window.CeroDrag) CeroDrag.bindHand(handEl, isMyTurn);
}

function _renderPlayerHand(state, game) {
  const el = document.getElementById('playerHand');
  if (!el) return;

  const isMyTurn = state.phase === G().PLAYER_TURN && state.current === 0;
  const hand     = state.realHands?.[0] || [];
  const topCard  = state.discard?.length ? state.discard[state.discard.length - 1] : null;
  const canPlayFn = window.canPlayOn || (typeof canPlayOn === 'function' ? canPlayOn : null);
  const testPlay = c => isMyTurn && topCard && canPlayFn &&
    canPlayFn(c, topCard, state.color, state.drawStack, hand);
  const sorted   = _sortHandCards(hand, isMyTurn, testPlay);
  const handSig  = `${state.phase}|${state.current}|${sorted.map(c => `${c.id}:${testPlay(c) ? 1 : 0}`).join(',')}`;

  if (el.dataset.handSig === handSig && el.querySelector('.cero-card')) {
    el.classList.toggle('hand-disabled', !isMyTurn);
    if (window.CeroDrag) CeroDrag.bindHand(el, isMyTurn);
    return;
  }
  el.dataset.handSig = handSig;
  el.innerHTML = '';

  sorted.forEach(card => {
    _appendHandCard(el, card, { isMyTurn, canPlay: testPlay(card) });
  });

  _finishHandRender(el, isMyTurn);

  const badge = document.getElementById('ceroBadge');
  if (badge) {
    badge.style.display = hand.length === 1 && !_ceroSaidHas(state, 0) ? 'flex' : 'none';
  }
}

function _showPlayHint(msg) {
  const el = document.getElementById('statusBanner');
  if (el && msg) {
    el.textContent = msg;
    el.classList.add('status-myturn');
  }
}

// ── Actions panel ─────────────────────────────────────────────────────────────
function _renderActions(state, game) {
  const bar = document.getElementById('actionBar');
  if (!bar) return;
  bar.innerHTML = '';

  const isMyTurn = state.phase === G().PLAYER_TURN && state.current === 0;

  if (state.phase === G().COLOR_PICK) {
    bar.innerHTML = '<span class="action-prompt">Elegí un color:</span>';
    (window.COLORS || []).forEach(color => {
      const css = _colorCss()[color] || {};
      const btn = document.createElement('button');
      btn.className   = 'color-pick-btn';
      btn.style.cssText = `--cc:${css.cc};--cg:${css.cg}`;
      btn.textContent = css.label;
      btn.addEventListener('click', () => game.pickColor(color));
      bar.appendChild(btn);
    });
    return;
  }

  if (state.phase === G().SWAP_PICK) {
    bar.innerHTML = '<span class="action-prompt">¿Con quién intercambiás tu mano?</span>';
    for (let i = 1; i < (state.playerCount || 2); i++) {
      const btn = document.createElement('button');
      btn.className   = 'swap-pick-btn';
      btn.textContent = `CPU ${i} (${(state.realHands?.[i] || []).length} cartas)`;
      btn.addEventListener('click', () => game.pickSwapTarget(i));
      bar.appendChild(btn);
    }
    return;
  }

  if (state.phase === G().GAME_OVER) {
    const btn = document.createElement('button');
    btn.className   = 'action-btn-main';
    btn.textContent = 'Nueva Partida';
    btn.addEventListener('click', () => game.restart());
    bar.appendChild(btn);
    return;
  }

  if (isMyTurn) {
    const hand   = state.realHands?.[0] || [];
    const canSay = hand.length === 1 && !_ceroSaidHas(state, 0);

    if (canSay) {
      const btn = document.createElement('button');
      btn.className   = 'cero-say-btn';
      btn.textContent = '¡CERO!';
      btn.addEventListener('click', () => game.sayCero());
      bar.appendChild(btn);
    }

    if (state.drawStack > 0) {
      const btn = document.createElement('button');
      btn.className   = 'draw-force-btn';
      btn.textContent = `Robar ${state.drawStack} cartas`;
      btn.addEventListener('click', () => game.playerDraw());
      bar.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.className   = 'draw-btn';
      btn.textContent = 'Robar carta';
      btn.addEventListener('click', () => game.playerDraw());
      bar.appendChild(btn);
    }
  }
}

// ── Status banner ─────────────────────────────────────────────────────────────
function _renderStatus(state) {
  const el = document.getElementById('statusBanner');
  if (!el) return;

  const P = G();
  const msgs = {
    [P.DEALING]:     'Repartiendo cartas...',
    [P.PLAYER_TURN]: state.current === 0 ? 'Tu turno' : `CPU ${state.current} pensando...`,
    [P.CPU_TURN]:    `CPU ${state.current} pensando...`,
    [P.COLOR_PICK]:  '🎨 Elegí el color activo',
    [P.SWAP_PICK]:   '⇌ Elegí con quién intercambiar',
    [P.MIRROR_WAIT]: '◈ Espejo activo — el próximo +2/+4 rebota',
    [P.GAME_OVER]:   _gameOverMsg(state),
  };

  const curName = state.playerNames?.[state.current] || (state.current === 0 ? 'Vos' : `CPU ${state.current}`);
  if (state.phase === P.PLAYER_TURN && state.current !== 0) {
    msgs[P.PLAYER_TURN] = `${curName} pensando...`;
  }
  if (state.phase === P.CPU_TURN) msgs[P.CPU_TURN] = `${curName} pensando...`;

  el.textContent = msgs[state.phase] ?? 'Tu turno';
  el.className   = `status-banner ${state.phase === P.GAME_OVER ? 'status-over' : ''} ${state.current === 0 && state.phase === P.PLAYER_TURN ? 'status-myturn' : ''}`;
}

function _gameOverMsg(state) {
  if (state.teams) {
    const myTeam = state.teams[0];
    const won = state.winner === myTeam;
    return won ? '🏆 ¡Tu equipo ganó la mano!' : 'El rival ganó la mano. Revancha';
  }
  if (state.winner === 0) return '🏆 ¡Ganaste! ¡CERO!';
  const n = state.playerNames?.[state.winner] || `CPU ${state.winner}`;
  return `${n} gana. ¡Revancha!`;
}

function _renderMySeatLabel(state) {
  const nameEl = document.getElementById('myPlayerName');
  const teamEl = document.getElementById('myTeamBadge');
  const heroEl = document.getElementById('myTeamHero');
  if (nameEl) nameEl.textContent = state.playerNames?.[0] || 'Vos';

  if (state.teams) {
    const t = state.teams[0];
    const label = t === 0 ? 'EQUIPO A' : 'EQUIPO B';
    if (teamEl) {
      teamEl.style.display = 'inline-flex';
      teamEl.textContent = label;
      teamEl.className = `player-team-badge team-${t} team-ally`;
    }
    if (heroEl) {
      heroEl.style.display = 'flex';
      heroEl.className = `my-team-hero team-${t} team-ally`;
      heroEl.innerHTML = `<span class="mth-label">TU EQUIPO</span><span class="mth-name">${label}</span>`;
    }
    const pz = document.querySelector('.player-zone');
    if (pz) pz.classList.toggle('player-zone-ally', true);
  } else {
    if (teamEl) teamEl.style.display = 'none';
    if (heroEl) heroEl.style.display = 'none';
  }
}

function _renderScoreboard(state) {
  const list = document.getElementById('scoreList');
  const mobile = document.getElementById('mobileScoreStrip');
  if (list) list.innerHTML = '';
  if (mobile) mobile.innerHTML = '';

  if (state.teams) {
    const myT = state.myTeam ?? state.teams[0];
    ['team0', 'team1'].forEach((key, i) => {
      const row = document.createElement('div');
      const isMine = i === myT;
      row.className = `score-row team-row team-${i}${isMine ? ' score-my-team' : ''}`;
      row.innerHTML = `<span class="sr-name sr-team-big">EQUIPO ${i === 0 ? 'A' : 'B'}${isMine ? ' · TUYO' : ''}</span><span class="sr-pts">${state.matchScore?.[key] ?? 0}</span>`;
      list.appendChild(row);
    });
    return;
  }

  if (state._online && state._players?.length) {
    state._players.forEach((p, i) => {
      const row = document.createElement('div');
      const isMe = i === state._myIndex;
      row.className = `score-row${state.current === i ? ' score-active' : ''}${isMe ? ' score-my-team' : ''}`;
      const name = isMe ? (state.playerNames?.[i] || 'Vos') : (p.name || `Jugador ${i + 1}`);
      const cards = state._handCounts?.[p.uid] ?? (state.realHands?.[i] || state.hands?.[i] || []).length;
      row.innerHTML = `<span class="sr-name">${name}</span><span class="sr-cards">${cards} 🃏</span><span class="sr-pts">${state.matchScore?.[`p${i}`] ?? 0}</span>`;
      list?.appendChild(row);

      if (mobile) {
        const chip = document.createElement('span');
        chip.className = `mob-score-chip${state.current === i ? ' mob-active' : ''}${isMe ? ' mob-me' : ''}`;
        chip.textContent = `${isMe ? 'Vos' : (p.name?.split(' ')[0] || 'Rival')}: ${cards}🃏`;
        mobile.appendChild(chip);
      }
    });
    return;
  }

  const count = state.playerCount || 2;
  for (let i = 0; i < count; i++) {
    const row = document.createElement('div');
    row.className = `score-row${state.current === i ? ' score-active' : ''}`;
    const name = state.playerNames?.[i] || (i === 0 ? 'Vos' : `CPU ${i}`);
    const cards = (state.realHands?.[i] || state.hands?.[i] || []).length;
    row.innerHTML = `<span class="sr-name">${name}</span><span class="sr-cards">${cards} 🃏</span><span class="sr-pts">${state.matchScore?.[`p${i}`] ?? 0}</span>`;
    list.appendChild(row);
  }
}

// ── Draw stack counter ────────────────────────────────────────────────────────
function _renderDrawStack(state) {
  const el = document.getElementById('drawStackBadge');
  if (!el) return;
  el.style.display = state.drawStack > 0 ? 'flex' : 'none';
  el.textContent   = `+${state.drawStack}`;
}

// ── Online mode renderer ──────────────────────────────────────────────────────
function _hideOnlineWaitingOverlay(ceroTable) {
  ceroTable?.querySelectorAll('.online-waiting-overlay').forEach(el => el.remove());
}

function _showColorPickerOverlay(game) {
  let el = document.getElementById('ceroColorOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ceroColorOverlay';
    el.className = 'cero-color-overlay';
    el.innerHTML = '<div class="cero-color-panel"><p class="cero-color-title">Elegí el color en juego</p><div class="cero-color-btns" id="ceroColorBtns"></div></div>';
    document.body.appendChild(el);
  }
  el.classList.add('active');
  const btns = document.getElementById('ceroColorBtns');
  if (!btns) return;
  btns.innerHTML = '';
  (window.COLORS || []).forEach(color => {
    const css = _colorCss()[color] || {};
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `color-pick-btn color-pick-big color-${color}`;
    b.style.cssText = `--cc:${css.cc};--cg:${css.cg}`;
    b.textContent = css.label || color;
    b.addEventListener('click', () => {
      _hideColorPickerOverlay();
      (window._ceroGame || game)?.pickColor?.(color);
    });
    btns.appendChild(b);
  });
}

function _hideColorPickerOverlay() {
  document.getElementById('ceroColorOverlay')?.classList.remove('active');
}

function _showWaitingOverlay(ceroTable) {
  if (!ceroTable || ceroTable.querySelector('.online-waiting-overlay')) return;
  const overlay = document.createElement('div');
  overlay.className = 'online-waiting-room online-waiting-overlay';
  overlay.innerHTML = `
    <div class="owr-logo">CERO</div>
    <div class="owr-spinner"></div>
    <div class="owr-msg" id="owrMsg">Conectando…</div>
    <button type="button" class="owr-deal-btn" id="owrDealBtn" style="display:none">Repartir cartas</button>
    <a href="/" class="owr-back">← Volver al lobby</a>`;
  ceroTable.appendChild(overlay);
}

function _ensureOnlineTable(container, state) {
  if (!container) return;
  const needsRestore = !container.querySelector('#playerHand')
    || !container.querySelector('#discardPile')
    || container.querySelector('.online-waiting-room:not(.online-waiting-overlay)');
  if (needsRestore) _restoreGameTable(container, state);
}

function renderCeroOnline(state, game) {
  const ceroTable = document.getElementById('ceroTable');
  if (!ceroTable) return;

  const n = (state._players || []).length;
  const max = state.maxPlayers || state.playerCount || 2;

  _renderScoreboard(state);
  if (window.CeroTurnTimer) CeroTurnTimer.sync(state);

  if (state._dealError) {
    const owrMsg = document.getElementById('owrMsg');
    if (owrMsg) owrMsg.textContent = state._dealError;
    return;
  }

  const waitingForRival = state._waiting && n < max;
  const preparing = state._waiting || state._dealing;

  if (waitingForRival || preparing) {
    let overlay = ceroTable.querySelector('.online-waiting-overlay');
    if (!overlay) {
      _showWaitingOverlay(ceroTable);
      overlay = ceroTable.querySelector('.online-waiting-overlay');
    }
    const owrMsg = document.getElementById('owrMsg');
    const dealBtn = document.getElementById('owrDealBtn');
    if (owrMsg) {
      if (waitingForRival) {
        owrMsg.textContent = `Esperando rival… (${n}/${max}). Invitá desde el hub o compartí el link.`;
      } else if (state._dealError) {
        owrMsg.textContent = state._dealError;
      } else {
        owrMsg.textContent = 'Repartiendo cartas…';
      }
    }
    if (dealBtn) {
      const showBtn = !waitingForRival && n >= max;
      dealBtn.style.display = showBtn ? 'inline-block' : 'none';
      dealBtn.onclick = showBtn ? () => game._attemptDeal?.() : null;
    }
    return;
  }

  _hideOnlineWaitingOverlay(ceroTable);
  _ensureOnlineTable(ceroTable, state);

  // Render opponent seats
  _renderOnlineSeats(state);

  // Common renders (reuse offline functions)
  _renderDiscard(state);
  _renderOnlineDeck(state, game);
  _renderColorIndicator(state);
  _renderOnlineHand(state, game);
  _renderOnlineActions(state, game);
  _renderOnlineStatus(state);
  _renderDrawStack(state);
  _renderCardHint(state);
  if (window.CeroTableSkins?.applyOnline) CeroTableSkins.applyOnline();
  else if (window.CeroTableSkins) CeroTableSkins.apply();
  _syncClassicGuidePanel(state);

  if (state._reconnectMsg) {
    const el = document.getElementById('statusBanner');
    if (el) el.textContent = state._reconnectMsg;
  }

  const denBtn = document.getElementById('btnDenounceCero');
  if (denBtn) {
    const show = state.ceroForgot && state.ceroForgot !== game.myUid;
    denBtn.style.display = show ? 'block' : 'none';
    denBtn.onclick = show ? () => game.denunciarNoDijoCero() : null;
  }
}

function _restoreGameTable(container, state) {
  container.innerHTML = `
    <div class="table-oval">
      <div class="cpu-seats-layer" id="cpuSeats"></div>
      <div class="table-center" id="tableCenter">
        <div class="center-piles">
          <div class="pile-wrap pile-deck-wrap">
            <div class="pile-label">Mazo</div>
            <div class="card-pile deck-pile" id="deckPile"></div>
          </div>
          <div class="center-divider" hidden>
            <div class="color-indicator" id="colorIndicator" title="Color activo (Modo Cero)"></div>
            <div class="draw-stack-badge" id="drawStackBadge" style="display:none">+0</div>
          </div>
          <div class="pile-wrap pile-discard-wrap">
            <div class="pile-label">Descarte</div>
            <div class="card-pile discard-pile discard-face-up" id="discardPile"></div>
          </div>
        </div>
      </div>
      <div class="status-banner" id="statusBanner"></div>
    </div>
    <div class="player-zone">
      <div class="player-label">
        <span class="player-name-badge" id="myPlayerName">Vos</span>
        <div class="cero-say-indicator" id="ceroBadge" style="display:none">CERO!</div>
      </div>
      <div class="player-hand" id="playerHand"></div>
      <div class="action-bar" id="actionBar"></div>
    </div>`;

  const session = JSON.parse(sessionStorage.getItem('cero_user') || '{}');
  const nb = document.getElementById('myPlayerName');
  if (nb && session.name) nb.textContent = session.name;
  if (window.CeroDrag) CeroDrag.init();
}

function _renderOnlineSeats(state) {
  const wrap = document.getElementById('cpuSeats');
  if (!wrap) return;
  wrap.innerHTML = '';

  const players = state._players || [];
  const counts  = state._handCounts || {};
  const positions = getSeatPositions(state.playerCount);
  const isTwoPlayer = (state.playerCount || 2) <= 2;

  players.forEach((p, i) => {
    if (i === state._myIndex) return;
    const pos = isTwoPlayer ? { x: 50, y: 18 } : positions[i];
    const count  = counts[p.uid] || 0;
    const isTurn = state.current === i;

    const seat = document.createElement('div');
    seat.className = `cpu-seat${isTurn ? ' seat-active' : ''}`;
    seat.style.cssText = `left:${pos.x}%;top:${pos.y}%;`;
    seat.innerHTML = `
      <div class="cpu-avatar ${isTurn ? 'cpu-thinking' : ''}">${p.name?.[0]?.toUpperCase() || '?'}</div>
      <div class="cpu-name-label">${p.name || 'Rival'}</div>
      <div class="cpu-card-count">
        ${count <= 5
          ? Array(count).fill('<div class="cpu-mini-card"></div>').join('')
          : `<div class="cpu-mini-card"></div><span class="cpu-count-badge">×${count}</span>`}
      </div>
      ${count === 1 ? '<div class="cero-badge">CERO!</div>' : ''}`;
    wrap.appendChild(seat);
  });
}

function _renderOnlineDeck(state, game) {
  const el = document.getElementById('deckPile');
  if (!el) return;
  el.innerHTML = '';
  const deckCount = state.deckCount ?? 20;
  for (let i = 0; i < Math.min(3, Math.max(1, deckCount)); i++) {
    const back = buildCeroCard(null, { faceDown: true, small: true });
    back.style.cssText = `position:absolute;top:${-i * 2}px;left:${-i}px;z-index:${i}`;
    el.appendChild(back);
  }
  const isMyTurn = state._localPhase === 'my_turn';
  el.classList.toggle('deck-active', isMyTurn);
  el.dataset.action = isMyTurn ? 'draw' : '';
  el.onclick = isMyTurn
    ? () => (window._ceroGame || game)?.drawCard?.()
    : null;
}

function _renderOnlineHand(state, game) {
  const el = document.getElementById('playerHand');
  if (!el) return;

  const myCards  = (state.hands[state._myIndex] || []).filter(Boolean);
  const expected = state._handCounts?.[game.myUid] ?? 0;
  const isMyTurn = state._localPhase === 'my_turn';

  if (!state._waiting && expected > 0 && myCards.length === 0) {
    el.innerHTML = '<p class="hand-loading-msg">Cargando tu mano…</p>';
    el.classList.add('hand-disabled');
    return;
  }
  const top = state.discard?.[state.discard.length - 1];
  const mustSayCero = myCards.length === 1 && !state.ceroCalled?.[game.myUid];
  const blockFn = window.playBlockReason;
  const testPlay = c => isMyTurn && top && blockFn &&
    blockFn(c, top, state.color, state.drawStack ?? 0, myCards, { mustSayCero }) === null;
  const sorted   = _sortHandCards(myCards, isMyTurn, testPlay);
  const topKey = top ? `${top.id}:${top.color}:${top.value}` : 'none';
  const handSig  = `${state._localPhase}|${state.color}|${state.drawStack}|${topKey}|${mustSayCero ? 1 : 0}|${sorted.map(c => `${c.id}:${testPlay(c) ? 1 : 0}`).join(',')}`;

  if (el.dataset.handSig === handSig && el.querySelector('.cero-card')) {
    el.classList.toggle('hand-disabled', !isMyTurn);
    if (window.CeroDrag) CeroDrag.bindHand(el, isMyTurn);
    return;
  }
  el.dataset.handSig = handSig;
  el.innerHTML = '';

  sorted.forEach(card => {
    const canPlay = isMyTurn && testPlay(card);
    const hint = (!canPlay && isMyTurn && blockFn)
      ? (blockFn(card, top, state.color, state.drawStack ?? 0, myCards, { mustSayCero }) || '')
      : '';
    _appendHandCard(el, card, { isMyTurn, canPlay, hint });
  });

  if (isMyTurn && myCards.length && !sorted.some(c => testPlay(c))) {
    const tip = document.createElement('p');
    tip.className = 'hand-play-hint';
    tip.textContent = state.drawStack > 0
      ? 'Tenés que robar o apilar +2/+4 — tocá el mazo.'
      : 'Ninguna carta coincide — robá del mazo (centro).';
    el.appendChild(tip);
  }

  _finishHandRender(el, isMyTurn);

  const badge = document.getElementById('ceroBadge');
  const said = state.ceroCalled?.[game.myUid];
  if (badge) {
    badge.style.display = myCards.length === 1 && !said ? 'flex' : 'none';
    badge.textContent = said ? '✓ CERO' : 'CERO!';
    badge.onclick = myCards.length === 1 && !said && state._localPhase === 'my_turn'
      ? () => game.sayCero()
      : null;
  }
}

function _renderOnlineActions(state, game) {
  const bar = document.getElementById('actionBar');
  if (!bar) return;
  bar.innerHTML = '';

  if (state._localPhase === 'color_pick') {
    _showColorPickerOverlay(game);
    bar.innerHTML = '<span class="action-prompt">Comodín — elegí el color que sigue:</span>';
    (window.COLORS || []).forEach(color => {
      const css = _colorCss()[color] || {};
      const btn = document.createElement('button');
      btn.className     = 'color-pick-btn';
      btn.style.cssText = `--cc:${css.cc};--cg:${css.cg}`;
      btn.textContent   = css.label;
      btn.addEventListener('click', () => {
        _hideColorPickerOverlay();
        (window._ceroGame || game)?.pickColor?.(color);
      });
      bar.appendChild(btn);
    });
    return;
  }
  _hideColorPickerOverlay();

  if (state._localPhase === 'game_over') {
    const winner = (state._players || []).find(p => p.uid === state.winner);
    const iWon = winner?.uid === game.myUid;
    const rankMsg = window.MatchRewards
      ? (iWon ? `+${MatchRewards.WIN_RANK} pts · +${MatchRewards.WIN_XP} XP` : `${MatchRewards.LOSS_RANK} pts · +${MatchRewards.LOSS_XP} XP`)
      : '';
    const msg    = iWon ? '🏆 ¡Ganaste!' : `¡${winner?.name || 'Rival'} ganó!`;
    bar.innerHTML = `<span class="action-prompt">${msg}${rankMsg ? ` · ${rankMsg}` : ''}</span>`;
    const btn = document.createElement('button');
    btn.className   = 'action-btn-main';
    btn.textContent = '← Volver al lobby';
    btn.addEventListener('click', () => { window.location.href = '/'; });
    bar.appendChild(btn);
    return;
  }

  if (state._localPhase === 'my_turn') {
    const myCards = state.hands[state._myIndex] || [];
    const mustCero = state.puedeCantarCero === game.myUid || (myCards.length === 1 && !state.ceroCalled?.[game.myUid]);
    if (state.drawStack > 0) {
      const hint = document.createElement('span');
      hint.className = 'action-prompt';
      hint.textContent = `Robá ${state.drawStack} cartas o apilá +2/+4`;
      bar.appendChild(hint);
    }
    if (mustCero) {
      const btn = document.createElement('button');
      btn.className   = 'cero-say-btn cero-say-btn--giant';
      btn.textContent = '★ ¡CERO!';
      btn.title = 'Decilo antes de tirar tu última carta';
      btn.addEventListener('click', () => game.sayCero());
      bar.appendChild(btn);
    }
    if (state.drawStack > 0) {
      const btn = document.createElement('button');
      btn.className   = 'draw-force-btn';
      btn.textContent = `Robar ${state.drawStack} cartas`;
      btn.addEventListener('click', () => game.drawCard());
      bar.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.className   = 'draw-btn';
      btn.textContent = 'Robar carta';
      btn.addEventListener('click', () => game.drawCard());
      bar.appendChild(btn);
    }
  }

  if (state.ceroForgot && state.ceroForgot !== game.myUid) {
    const btn = document.createElement('button');
    btn.className   = 'cero-denounce-btn';
    btn.textContent = '¡NO DIJO CERO!';
    btn.title = 'El rival tiró sin cantar CERO — penalidad +2';
    btn.addEventListener('click', () => game.denunciarNoDijoCero());
    bar.appendChild(btn);
  }

  const afk = state._myAfkStrikes || 0;
  if (afk > 0 && state._localPhase === 'my_turn') {
    const warn = document.createElement('span');
    warn.className = 'afk-warn';
    warn.textContent = `AFK ${afk}/3 — jugada automática al terminar el tiempo`;
    bar.appendChild(warn);
  }
}

function _renderOnlineStatus(state) {
  const el = document.getElementById('statusBanner');
  if (!el) return;

  const players = state._players || [];
  const myUid   = players[state._myIndex]?.uid || null;
  const curIdx  = state.current;
  const curName = curIdx === state._myIndex ? 'Tu turno' : `Turno de ${players[curIdx]?.name || 'rival'}`;

  const msgs = {
    waiting:    'Esperando al oponente...',
    dealing:    'Repartiendo cartas...',
    my_turn:    state.ceroForgot === myUid
                  ? '¡Denunciá si no dijo CERO!'
                  : (state.puedeCantarCero === myUid ? '¡Apretá CERO! antes de tu última carta' : 'Tu turno — jugá o robá'),
    opp_turn:   curName,
    color_pick: '🎨 Elegí el color activo',
    game_over:  players.find(p => p.uid === state.winner)?.uid === state._players?.[state._myIndex]?.uid
                  ? '🏆 ¡Ganaste! ¡CERO!'
                  : `¡${players.find(p => p.uid === state.winner)?.name || 'Rival'} ganó! Revancha!`,
  };
  el.textContent = msgs[state._localPhase] ?? '';
  el.className   = `status-banner ${state._localPhase === 'game_over' ? 'status-over' : ''} ${state._localPhase === 'my_turn' ? 'status-myturn' : ''}`;
}

function _renderCardHint(state) {
  const top = state.discard?.[state.discard.length - 1];
  let el = document.getElementById('cardHintBanner');
  if (!top) {
    if (el) el.textContent = '';
    return;
  }
  if (!el) {
    const wrap = document.querySelector('.pile-discard-wrap');
    if (!wrap) return;
    el = document.createElement('p');
    el.id = 'cardHintBanner';
    el.className = 'card-hint-banner';
    wrap.appendChild(el);
  }
  if (typeof window.cardHelpText === 'function') {
    el.textContent = cardHelpText(top, state.color);
  }
}

window.renderCero = renderCero;
window.renderCeroOnline = renderCeroOnline;
window.buildCeroCard = buildCeroCard;
