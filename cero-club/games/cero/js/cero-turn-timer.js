'use strict';

/**
 * Timer de turno CERO — barra visual + auto-robar al vencer.
 */
const CeroTurnTimer = (() => {
  const DEFAULT_SEC = 15;
  let _raf = null;
  let _game = null;
  let _deadline = 0;
  let _totalMs = DEFAULT_SEC * 1000;
  let _warnPlayed = false;
  let _critPlayed = false;
  let _endPlayed = false;

  function _el(id) { return document.getElementById(id); }

  function bind(game) {
    _game = game;
  }

  function sync(state) {
    const wrap = _el('turnTimerWrap');
    if (!wrap) return;

    const dl = state?.turnDeadline;
    const isMyTurn = _isMyTurn(state);

    if (!dl || !isMyTurn) {
      stop();
      wrap.setAttribute('aria-hidden', 'true');
      return;
    }

    _deadline = typeof dl === 'number' ? dl : dl;
    _totalMs = state.turnSeconds ? state.turnSeconds * 1000 : DEFAULT_SEC * 1000;
    _warnPlayed = false;
    _critPlayed = false;
    _endPlayed = false;
    wrap.setAttribute('aria-hidden', 'false');
    _tick();
  }

  function _playBeep(kind) {
    if (_game?.voice?.sfx) {
      if (kind === 'end' && typeof _game.voice.sfx === 'function') {
        _game.voice.sfx('draw');
        return;
      }
      if (kind === 'critical') _game.voice.sfx('skip');
      else if (kind === 'warn') _game.voice.sfx('reverse');
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const cfg = kind === 'end'
        ? { freq: 180, dur: 0.28, vol: 0.22, type: 'square' }
        : kind === 'critical'
          ? { freq: 720, dur: 0.14, vol: 0.2, type: 'square' }
          : { freq: 480, dur: 0.1, vol: 0.14, type: 'sine' };
      osc.type = cfg.type;
      osc.frequency.value = cfg.freq;
      gain.gain.setValueAtTime(cfg.vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + cfg.dur);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + cfg.dur);
      setTimeout(() => ctx.close().catch(() => {}), (cfg.dur + 0.1) * 1000);
    } catch (_) { /* sin audio */ }
  }

  function _isMyTurn(state) {
    if (!state) return false;
    if (state._online) {
      return state._localPhase === 'my_turn';
    }
    const P = window.G_PHASE;
    return P && state.phase === P.PLAYER_TURN && state.current === 0;
  }

  function _tick() {
    if (_raf) cancelAnimationFrame(_raf);
    const bar = _el('turnTimerBar');
    const lbl = _el('turnTimerLbl');
    const wrap = _el('turnTimerWrap');
    if (!bar || !wrap) return;

    const now = Date.now();
    const left = Math.max(0, _deadline - now);
    const pct = Math.min(100, (left / _totalMs) * 100);
    bar.style.width = `${pct}%`;
    bar.classList.toggle('timer-warn', left < 5000);
    bar.classList.toggle('timer-critical', left < 3000);
    if (lbl) lbl.textContent = left > 0 ? `Tu turno · ${Math.ceil(left / 1000)}s` : '¡Tiempo!';

    if (left <= 5000 && left > 3000 && !_warnPlayed) {
      _warnPlayed = true;
      _playBeep('warn');
    }
    if (left <= 3000 && left > 0 && !_critPlayed) {
      _critPlayed = true;
      _playBeep('critical');
    }

    if (left <= 0) {
      wrap.setAttribute('aria-hidden', 'true');
      if (!_endPlayed) {
        _endPlayed = true;
        _playBeep('end');
      }
      if (_game && typeof _game.onTurnTimeout === 'function') {
        _game.onTurnTimeout();
      }
      return;
    }
    _raf = requestAnimationFrame(_tick);
  }

  function stop() {
    if (_raf) cancelAnimationFrame(_raf);
    _raf = null;
    const bar = _el('turnTimerBar');
    if (bar) {
      bar.style.width = '100%';
      bar.classList.remove('timer-warn', 'timer-critical');
    }
  }

  return { bind, sync, stop, DEFAULT_SEC };
})();

window.CeroTurnTimer = CeroTurnTimer;
