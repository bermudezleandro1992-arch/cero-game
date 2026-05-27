'use strict';

/**
 * Items sanos tipo UNO — animación sobre el rival (chat + Firestore).
 */
const CeroThrows = (() => {
  const ITEMS = [
    { id: 'cc_win',  icon: '◈', label: 'CC',     msg: '◈ ¡Skill gaming!' },
    { id: 'gg',      icon: '👏', label: 'GG',     msg: '¡Bien jugado!' },
    { id: 'luck',    icon: '🍀', label: 'Suerte', msg: '¡Mucha suerte!' },
    { id: 'think',   icon: '🤔', label: 'Pensá',  msg: 'Pensalo bien...' },
    { id: 'fire',    icon: '🔥', label: 'Fuego',  msg: '¡Estás en racha!' },
    { id: 'star',    icon: '⭐', label: 'Estrella', msg: '★ Brillás hoy' },
    { id: 'trophy',  icon: '🏆', label: 'Trophy', msg: 'Campeón en la mesa' },
    { id: 'wink',    icon: '😉', label: 'Guiño',  msg: 'Tranqui, es juego' },
  ];

  let _roomId = null;
  let _myUid = null;

  function init(opts = {}) {
    _roomId = opts.roomId || null;
    _myUid  = opts.uid || null;
    _renderButtons();
  }

  function _renderButtons() {
    const wrap = document.getElementById('throwBtns');
    if (!wrap) return;
    wrap.innerHTML = ITEMS.map(it =>
      `<button type="button" class="throw-btn" data-throw="${it.id}" title="${it.label}">${it.icon}</button>`
    ).join('');
    wrap.querySelectorAll('[data-throw]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = ITEMS.find(i => i.id === btn.dataset.throw);
        if (item) throwItem(item);
      });
    });
  }

  async function throwItem(item) {
    if (window.CeroChat?.send) {
      await window.CeroChat.send(item.msg, { throwItem: item.id, throwIcon: item.icon });
    }
    _spawnOnRival(item.icon);
  }

  function _spawnOnRival(icon) {
    const seat = document.querySelector('.cpu-seat .cpu-avatar');
    if (!seat) return;
    const el = document.createElement('span');
    el.className = 'throw-fx';
    el.textContent = icon;
    seat.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  function showIncoming(icon) {
    _spawnOnRival(icon || '◈');
  }

  return { init, throwItem, showIncoming, ITEMS };
})();

window.CeroThrows = CeroThrows;
