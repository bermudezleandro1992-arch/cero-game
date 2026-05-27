'use strict';

/**
 * Chat de mesa CERO — offline local + Firestore en partidas online.
 */
const CeroChat = (() => {
  let _roomId = null;
  let _myUid = null;
  let _myName = 'Vos';
  let _unsub = null;

  function init(opts = {}) {
    _roomId = opts.roomId || null;
    _myUid  = opts.uid || null;
    _myName = opts.name || 'Vos';

    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    if (form && input) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        send(text);
        input.value = '';
      };
    }

    document.querySelectorAll('.chat-quick').forEach(btn => {
      btn.addEventListener('click', () => send(btn.dataset.msg || btn.textContent));
    });

    if (_roomId && window.FBHub) {
      _subscribeFirestore();
    } else {
      system('Bienvenido a la mesa CERO. ¡Buena suerte!');
    }
  }

  function _subscribeFirestore() {
    const hub = window.FBHub;
    if (!hub) return;
    const { db, collection, query, orderBy, limit, onSnapshot } = hub;
    const q = query(
      collection(db, 'rooms', _roomId, 'messages'),
      orderBy('at', 'asc'),
      limit(80)
    );
    _unsub = onSnapshot(q, snap => {
      const log = document.getElementById('chatLog');
      if (!log) return;
      log.innerHTML = '';
      snap.docs.forEach(d => {
        const m = d.data();
        const side = m.uid === _myUid ? 'me' : 'them';
        if (m.throwItem && m.uid !== _myUid && window.CeroThrows?.showIncoming) {
          CeroThrows.showIncoming(m.throwIcon || '◈');
        }
        append(m.name || 'Jugador', m.text || '', m.throwItem ? 'throw' : side);
      });
      log.scrollTop = log.scrollHeight;
    });
  }

  async function send(text, extra = {}) {
    if (!text) return;
    const isThrow = !!extra.throwItem;
    append(_myName, text, isThrow ? 'throw' : 'me');

    if (!_roomId || !window.FBHub) return;

    const hub = window.FBHub;
    try {
      await hub.addDoc(hub.collection(hub.db, 'rooms', _roomId, 'messages'), {
        uid:  _myUid || 'local',
        name: _myName,
        text,
        throwItem: extra.throwItem || null,
        throwIcon: extra.throwIcon || null,
        at:   hub.serverTimestamp(),
      });
    } catch (e) {
      console.warn('[CeroChat]', e);
    }
  }

  function system(text) {
    append('Mesa', text, 'system');
  }

  function append(name, text, side = 'them') {
    const log = document.getElementById('chatLog');
    if (!log) return;
    const div = document.createElement('div');
    div.className = `chat-msg chat-${side}`;
    const safe = String(text).replace(/</g, '&lt;');
    div.innerHTML = `<strong>${escapeHtml(name)}:</strong> ${safe}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function destroy() {
    if (_unsub) _unsub();
    _unsub = null;
  }

  return { init, send, append, system, destroy };
})();

window.CeroChat = CeroChat;
