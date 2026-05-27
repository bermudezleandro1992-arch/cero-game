'use strict';

/**
 * Chat del Hub: Global (lobby) + Privado (DM entre amigos).
 */
const HubChat = (() => {
  let _globalUnsub = null;
  let _dmUnsub = null;
  let _dmPeerUid = null;
  let _tab = 'global';

  function _hub() { return window.FBHub; }

  function _user() {
    try { return JSON.parse(sessionStorage.getItem('cero_user') || 'null'); } catch (_) { return null; }
  }

  function open() {
    if (typeof openModal === 'function') openModal('modalHubChat');
    _tab = 'global';
    switchTab('global');
    initGlobal();
    _fillFriendSelect();
  }

  function switchTab(tab) {
    _tab = tab;
    document.querySelectorAll('.hub-chat-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.hubChatTab === tab);
    });
    document.querySelectorAll('.hub-chat-panel').forEach(p => {
      p.classList.toggle('active', p.dataset.hubChatPanel === tab);
    });
    if (tab === 'global') initGlobal();
    if (tab === 'private') {
      _fillFriendSelect();
      if (_dmPeerUid) _listenDm(_dmPeerUid);
    }
  }

  function initGlobal() {
    const hub = _hub();
    const log = document.getElementById('hubChatGlobalLog');
    if (!hub || !log) return;

    if (_globalUnsub) _globalUnsub();
    const { db, collection, query, orderBy, limit, onSnapshot } = hub;
    const q = query(collection(db, 'lobby_messages'), orderBy('at', 'desc'), limit(60));
    _globalUnsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => d.data()).reverse();
      _renderLog(log, msgs, 'global');
    }, () => {
      log.innerHTML = '<p class="hub-chat-empty">Conectando...</p>';
    });
  }

  function _fillFriendSelect() {
    const sel = document.getElementById('hubChatFriendSelect');
    if (!sel) return;
    const friends = window.FriendsSocial?.getFriends?.() || [];
    sel.innerHTML = '<option value="">Elegí un amigo</option>' +
      friends.map(f => {
        const uid = f.uid || f.id;
        return `<option value="${uid}">${escapeHtml(f.name || 'Amigo')}</option>`;
      }).join('');
    if (_dmPeerUid) sel.value = _dmPeerUid;
  }

  function onFriendSelect(uid) {
    _dmPeerUid = uid || null;
    const log = document.getElementById('hubChatPrivateLog');
    if (!log) return;
    if (!uid) {
      log.innerHTML = '<p class="hub-chat-empty">Elegí un amigo para chatear en privado</p>';
      if (_dmUnsub) { _dmUnsub(); _dmUnsub = null; }
      return;
    }
    _listenDm(uid);
  }

  function _listenDm(peerUid) {
    const hub = _hub();
    const u = _user();
    const log = document.getElementById('hubChatPrivateLog');
    if (!hub || !u?.uid || !log) return;

    if (_dmUnsub) _dmUnsub();
    const { db, collection, query, where, orderBy, limit, onSnapshot } = hub;

    const q = query(
      collection(db, 'dm_messages'),
      where('participants', 'array-contains', u.uid),
      orderBy('at', 'asc'),
      limit(80)
    );

    _dmUnsub = onSnapshot(q, snap => {
      const msgs = snap.docs
        .map(d => d.data())
        .filter(m => {
          const p = m.participants || [];
          return p.includes(u.uid) && p.includes(peerUid);
        });
      _renderLog(log, msgs, 'private', peerUid);
    }, err => {
      console.warn('[HubChat DM]', err);
      log.innerHTML = '<p class="hub-chat-empty">No se pudo cargar el chat privado</p>';
    });
  }

  function _renderLog(el, msgs, mode, peerUid) {
    const me = _user()?.uid;
    if (!msgs.length) {
      el.innerHTML = `<p class="hub-chat-empty">${mode === 'global' ? 'Sé el primero en saludar 👋' : 'Enviá el primer mensaje'}</p>`;
      return;
    }
    el.innerHTML = msgs.map(m => {
      const mine = m.fromUid === me;
      const name = escapeHtml(m.name || m.fromName || 'Jugador');
      const text = escapeHtml(m.text || '');
      return `<div class="hub-chat-bubble${mine ? ' mine' : ''}"><span class="hcb-name">${name}</span>${text}</div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  async function sendGlobal(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('hubChatGlobalInput');
    return _sendLobby(input);
  }

  async function sendPrivate(e) {
    if (e) e.preventDefault();
    if (!_dmPeerUid) {
      alert('Elegí un amigo primero');
      return false;
    }
    const input = document.getElementById('hubChatPrivateInput');
    return _sendDm(input, _dmPeerUid);
  }

  async function _sendLobby(input) {
    const hub = _hub();
    const u = _user();
    if (!hub || !input) return false;
    if (!u?.uid || u.anon) {
      alert('Iniciá sesión (cuenta registrada) para escribir en el chat global.');
      return false;
    }
    const text = input.value.trim();
    if (!text) return false;
    try {
      const { db, collection, addDoc, serverTimestamp } = hub;
      if (!addDoc) throw new Error('Chat no disponible. Recargá la página.');
      await addDoc(collection(db, 'lobby_messages'), {
        uid: u.uid,
        name: u.name || 'Jugador',
        text: text.slice(0, 200),
        at: serverTimestamp(),
      });
      if (window.FriendsSocial?.notifyGlobalChat) {
        FriendsSocial.notifyGlobalChat(text).catch(() => {});
      }
      input.value = '';
    } catch (err) {
      console.warn('[HubChat]', err);
      alert(err?.code === 'permission-denied'
        ? 'No tenés permiso para chatear. Verificá que estés logueado.'
        : (err.message || 'No se pudo enviar el mensaje'));
    }
    return false;
  }

  async function _sendDm(input, peerUid) {
    const hub = _hub();
    const u = _user();
    if (!hub || !input || !peerUid) return false;
    if (!u?.uid || u.anon) {
      alert('Necesitás una cuenta para el chat privado.');
      return false;
    }
    const text = input.value.trim();
    if (!text) return false;
    try {
      const participants = [u.uid, peerUid].sort();
      const { db, collection, addDoc, serverTimestamp } = hub;
      if (!addDoc) throw new Error('Chat no disponible.');
      await addDoc(collection(db, 'dm_messages'), {
        fromUid: u.uid,
        toUid: peerUid,
        participants,
        name: u.name || 'Jugador',
        text: text.slice(0, 200),
        at: serverTimestamp(),
      });
      if (window.FriendsSocial?.notifyChatMessage) {
        await FriendsSocial.notifyChatMessage(peerUid, text);
      }
      input.value = '';
    } catch (err) {
      console.warn('[HubChat DM send]', err);
      alert(err.message || 'No se pudo enviar');
    }
    return false;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function destroy() {
    if (_globalUnsub) _globalUnsub();
    if (_dmUnsub) _dmUnsub();
    _globalUnsub = _dmUnsub = null;
  }

  return { open, switchTab, sendGlobal, sendPrivate, onFriendSelect, destroy, initGlobal: open };
})();

window.HubChat = HubChat;
window.openHubChat = () => HubChat.open();
