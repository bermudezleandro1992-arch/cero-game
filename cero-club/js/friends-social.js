'use strict';

/**
 * Amigos, invitaciones a salas y notificaciones (Firestore).
 */
const FriendsSocial = (() => {
  let _user = null;
  let _friends = [];
  let _pendingInvites = [];
  let _notifUnsub = null;
  let _requestsUnsub = null;
  let _pendingRequests = [];
  let _invitePickerGame = 'cero';

  function _hub() {
    return window.FBHub;
  }

  function _loadUser() {
    try {
      return JSON.parse(sessionStorage.getItem('cero_user') || 'null');
    } catch (_) {
      return null;
    }
  }

  function _genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  async function ensureFriendCode(uid) {
    const hub = _hub();
    if (!hub) return null;
    const ref = hub.doc(hub.db, 'users', uid);
    const snap = await hub.getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.friendCode) return data.friendCode;
    const code = _genCode();
    await hub.updateDoc(ref, { friendCode: code });
    return code;
  }

  function _authUid() {
    const hub = _hub();
    return hub?.auth?.currentUser?.uid || hub?.currentUser?.uid || null;
  }

  function _syncUser() {
    const session = _loadUser();
    const authUid = _authUid();
    if (!session && !authUid) {
      _user = null;
      return;
    }
    _user = { ...(session || {}), uid: authUid || session?.uid };
    if (session?.name) _user.name = session.name;
    if (session?.photo) _user.photo = session.photo;
    const fb = _hub()?.currentUser;
    if (fb?.displayName) _user.name = _user.name || fb.displayName;
  }

  async function init() {
    _syncUser();
    const myUid = _authUid() || _user?.uid;
    const hub = _hub();
    if (!myUid || !hub) return;
    if (hub.auth?.currentUser?.isAnonymous) return;
    _user = { ...(_user || {}), uid: myUid, anon: false };

    await ensureFriendCode(myUid);
    await refreshFriends();
    _listenNotifications();
    _listenIncomingRequests();
  }

  async function refreshFriends() {
    const hub = _hub();
    if (!hub || !_user?.uid) return;
    const snap = await hub.getDocs(hub.collection(hub.db, 'users', _user.uid, 'friends'));
    _friends = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return _friends;
  }

  function getFriends() {
    return [..._friends];
  }

  async function searchByCode(code) {
    _syncUser();
    const hub = _hub();
    if (!hub) throw new Error('Sin conexión');
    const myUid = _authUid() || _user?.uid;
    const q = hub.query(
      hub.collection(hub.db, 'users'),
      hub.where('friendCode', '==', String(code).trim().toUpperCase()),
      hub.limit(1)
    );
    const snap = await hub.getDocs(q);
    if (snap.empty) return null;
    const doc = snap.docs[0];
    if (doc.id === myUid) return null;
    const d = doc.data();
    return { uid: doc.id, name: d.displayName || d.name || 'Jugador', photo: d.photoURL || null, friendCode: d.friendCode };
  }

  async function sendFriendRequest(targetUid, targetName) {
    const hub = _hub();
    _syncUser();
    const myUid = _authUid() || _user?.uid;
    if (!hub || !myUid) throw new Error('Tenés que iniciar sesión con tu cuenta');
    if (hub.auth?.currentUser?.isAnonymous) throw new Error('Creá una cuenta registrada para agregar amigos');
    if (targetUid === myUid) throw new Error('No podés agregarte a vos mismo');

    const existing = _friends.find(f => f.uid === targetUid || f.id === targetUid);
    if (existing) throw new Error('Ya es tu amigo/a');

    const reqId = `${myUid}_${targetUid}`;
    const ref = hub.doc(hub.db, 'friend_requests', reqId);
    const prev = await hub.getDoc(ref);
    if (prev.exists()) {
      const st = prev.data().status;
      if (st === 'pending') throw new Error('Ya enviaste solicitud');
      if (st === 'accepted') throw new Error('Ya son amigos');
      await hub.deleteDoc(ref);
    }

    await hub.setDoc(ref, {
      fromUid:   myUid,
      toUid:     targetUid,
      fromName:  _user?.name || _user?.displayName || 'Jugador',
      toName:    targetName || 'Jugador',
      fromPhoto: _user?.photo || null,
      status:    'pending',
      createdAt: hub.serverTimestamp(),
    });

    try {
      await _pushNotification(targetUid, {
        type:    'friend_request',
        title:   'Nueva solicitud de amistad',
        body:    `${_user?.name || 'Alguien'} quiere ser tu amigo/a`,
        fromUid: myUid,
        fromName: _user?.name || 'Jugador',
        requestId: reqId,
        read:    false,
      });
    } catch (e) {
      console.warn('[Friends] notificación:', e);
    }
  }

  async function acceptFriendRequest(requestId) {
    const hub = _hub();
    _syncUser();
    const myUid = _authUid() || _user?.uid;
    if (!hub || !myUid) return;
    const ref = hub.doc(hub.db, 'friend_requests', requestId);
    const snap = await hub.getDoc(ref);
    if (!snap.exists()) return;
    const r = snap.data();
    if (r.toUid !== myUid || r.status !== 'pending') return;

    const batch = hub.writeBatch(hub.db);
    batch.update(ref, { status: 'accepted', acceptedAt: hub.serverTimestamp() });

    const a = hub.doc(hub.db, 'users', r.fromUid, 'friends', r.toUid);
    const b = hub.doc(hub.db, 'users', r.toUid, 'friends', r.fromUid);
    batch.set(a, { uid: r.toUid, name: r.toName || 'Jugador', since: hub.serverTimestamp() });
    batch.set(b, { uid: r.fromUid, name: r.fromName || 'Jugador', photo: r.fromPhoto || null, since: hub.serverTimestamp() });

    const friendName = r.fromName || 'Jugador';
    const myName = _user?.name || _user?.displayName || 'Jugador';

    await batch.commit();
    await _markNotifReadByRequest(requestId);
    await refreshFriends();
    await refreshPendingRequests();
    _renderFriendsPanel();
    _renderNotifList(_lastNotifItems || []);

    try {
      await _pushNotification(myUid, {
        type: 'friend_accepted',
        title: 'Amigo agregado',
        body: `Aceptaste a ${friendName}. Ya podés invitarlo a partidas y chatear en privado.`,
        fromUid: r.fromUid,
        fromName: friendName,
        read: false,
      });
      await _pushNotification(r.fromUid, {
        type: 'friend_accepted',
        title: 'Solicitud aceptada',
        body: `${myName} aceptó tu solicitud. ¡Ya son amigos en Cero Club!`,
        fromUid: myUid,
        fromName: myName,
        read: false,
      });
    } catch (e) {
      console.warn('[Friends] accept notif:', e);
    }

    _flashProfileMsg(
      `✓ Aceptaste a ${friendName}. Ya está en tu lista de amigos — podés invitarlo a CERO/Truco o mandarle mensaje privado.`,
      'ok',
      'amigos'
    );
  }

  async function declineFriendRequest(requestId) {
    const hub = _hub();
    if (!hub || !_user?.uid) return;
    const ref = hub.doc(hub.db, 'friend_requests', requestId);
    const snap = await hub.getDoc(ref);
    if (!snap.exists()) return;
    const r = snap.data();
    if (r.status !== 'pending') return;
    if (r.toUid === _user.uid) {
      await hub.updateDoc(ref, { status: 'declined' });
    } else if (r.fromUid === _user.uid) {
      await hub.deleteDoc(ref);
    }
    await _markNotifReadByRequest(requestId);
    await refreshPendingRequests();
    _renderFriendsPanel();
  }

  let _lastNotifItems = [];

  async function refreshPendingRequests() {
    const hub = _hub();
    _syncUser();
    const myUid = _authUid() || _user?.uid;
    if (!hub || !myUid) return [];
    const q = hub.query(
      hub.collection(hub.db, 'friend_requests'),
      hub.where('toUid', '==', myUid),
      hub.where('status', '==', 'pending')
    );
    const snap = await hub.getDocs(q);
    _pendingRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _updateAllBadges();
    return _pendingRequests;
  }

  function _listenIncomingRequests() {
    const hub = _hub();
    _syncUser();
    const myUid = _authUid() || _user?.uid;
    if (!hub || !myUid) return;
    if (_requestsUnsub) _requestsUnsub();
    const q = hub.query(
      hub.collection(hub.db, 'friend_requests'),
      hub.where('toUid', '==', myUid),
      hub.where('status', '==', 'pending')
    );
    _requestsUnsub = hub.onSnapshot(q, snap => {
      _pendingRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _updateAllBadges();
      if (_isProfileOpen() && _profileTab === 'amigos') {
        _renderPendingRequests();
      }
    }, err => console.warn('[Friends] requests listener:', err));
  }

  async function _pushNotification(targetUid, payload) {
    const hub = _hub();
    if (!hub) return;
    await hub.addDoc(hub.collection(hub.db, 'users', targetUid, 'notifications'), {
      ...payload,
      read: false,
      createdAt: hub.serverTimestamp(),
    });
  }

  function _listenNotifications() {
    const hub = _hub();
    _syncUser();
    const myUid = _authUid() || _user?.uid;
    if (!hub || !myUid) return;
    if (_notifUnsub) _notifUnsub();
    const q = hub.query(
      hub.collection(hub.db, 'users', myUid, 'notifications'),
      hub.orderBy('createdAt', 'desc'),
      hub.limit(30)
    );
    _notifUnsub = hub.onSnapshot(q, snap => {
      const prevIds = new Set((_lastNotifItems || []).map(n => n.id));
      _lastNotifItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      for (const n of _lastNotifItems) {
        if (n.type === 'room_invite' && n.read !== true && !prevIds.has(n.id)) {
          _showRoomInvitePopup(n);
        }
      }
      _renderNotifList(_lastNotifItems);
      _updateAllBadges();
    }, err => {
      console.warn('[Friends] notifications:', err);
      const el = document.getElementById('notifList');
      if (el) el.innerHTML = '<p class="notif-empty">No se pudieron cargar las alertas</p>';
    });
  }

  let _profileTab = 'perfil';
  let _profileTabIntent = 'perfil';

  function _isProfileOpen() {
    return document.getElementById('modalProfile')?.classList.contains('active');
  }

  const NOTIF_TYPES_ACTION = [
    'room_invite', 'chat_dm', 'chat_global', 'coins_received', 'coins_sent', 'coins_redeem', 'coins_purchase',
  ];

  function _badgeCount() {
    const pendingReq = _pendingRequests.length;
    const unreadAction = (_lastNotifItems || []).filter(
      n => n.read !== true && NOTIF_TYPES_ACTION.includes(n.type)
    ).length;
    return pendingReq + unreadAction;
  }

  function _formatBadge(n) {
    if (n > 99) return '99+';
    if (n > 9) return '9+';
    return String(n);
  }

  function _updateAllBadges() {
    const pendingReq = _pendingRequests.length;
    const total = _badgeCount();
    ['notifBadge', 'sidebarFriendsBadge', 'mpsNotifBadge', 'snavNotifBadge'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = _formatBadge(total);
      if (total > 0) {
        el.hidden = false;
        el.style.display = 'flex';
      } else {
        el.hidden = true;
        el.style.display = 'none';
      }
    });
    const countEl = document.getElementById('friendsPendingCount');
    if (countEl) {
      countEl.textContent = String(pendingReq);
      countEl.hidden = pendingReq === 0;
    }
    const friendsTabBadge = document.getElementById('profileTabFriendsBadge');
    if (friendsTabBadge) {
      friendsTabBadge.textContent = _formatBadge(pendingReq);
      friendsTabBadge.hidden = pendingReq === 0;
      friendsTabBadge.style.display = pendingReq > 0 ? 'inline-flex' : 'none';
    }
    const notifTabBadge = document.getElementById('profileTabNotifBadge');
    const notifOnly = (_lastNotifItems || []).filter(
      n => n.read !== true && (NOTIF_TYPES_ACTION.includes(n.type) || n.type === 'friend_request')
    ).length;
    if (notifTabBadge) {
      notifTabBadge.textContent = _formatBadge(notifOnly);
      notifTabBadge.hidden = notifOnly === 0;
      notifTabBadge.style.display = notifOnly > 0 ? 'inline-flex' : 'none';
    }
    document.querySelectorAll('.online-friends-btn, .topbar-notif-btn').forEach(btn => {
      btn.classList.toggle('has-alerts', total > 0);
    });
  }

  function _renderNotifList(items) {
    const el = document.getElementById('notifList');
    const html = _notifListHtml(items);
    if (!el) return;
    if (!items.length) {
      const empty = '<p class="notif-empty">No tenés notificaciones</p>';
      if (el) el.innerHTML = empty;
      return;
    }
    if (el) el.innerHTML = html;
  }

  function _notifListHtml(items) {
    if (!items.length) return '<p class="notif-empty">No tenés notificaciones</p>';
    return items.map(n => {
      const unread = n.read !== true ? ' notif-unread' : '';
      if (n.type === 'room_invite') {
        const gameLbl = (n.game === 'truco') ? 'Truco' : 'CERO';
        return `<div class="notif-item${unread}" data-id="${n.id}">
          <div class="notif-title">🎮 Invitación a ${gameLbl}</div>
          <div class="notif-body">${escapeHtml(n.fromName || 'Un amigo')} te invitó a jugar · ${escapeHtml(n.format || '1v1')}</div>
          <button type="button" class="notif-btn" onclick="FriendsSocial.joinRoom('${n.roomId}', '${n.id}')">Unirme a la sala</button>
        </div>`;
      }
      if (n.type === 'chat_dm') {
        const preview = escapeHtml(n.preview || n.body || 'Nuevo mensaje');
        return `<div class="notif-item${unread}" data-id="${n.id}">
          <div class="notif-title">💬 Mensaje privado</div>
          <div class="notif-body"><strong>${escapeHtml(n.fromName || 'Amigo')}</strong>: ${preview}</div>
          <button type="button" class="notif-btn" onclick="FriendsSocial.openChatFromNotif('${n.fromUid}', '${n.id}')">Ver chat</button>
        </div>`;
      }
      if (n.type === 'chat_global') {
        const preview = escapeHtml(n.preview || n.body || 'Mensaje en el lobby');
        return `<div class="notif-item${unread}" data-id="${n.id}">
          <div class="notif-title">🌐 Chat global</div>
          <div class="notif-body"><strong>${escapeHtml(n.fromName || 'Alguien')}</strong>: ${preview}</div>
          <button type="button" class="notif-btn" onclick="FriendsSocial.openGlobalChatFromNotif('${n.id}')">Ver chat global</button>
        </div>`;
      }
      if (n.type === 'coins_received' || n.type === 'coins_sent' || n.type === 'coins_redeem' || n.type === 'coins_purchase') {
        const title = n.type === 'coins_redeem' ? '🎁 Canje de código'
          : n.type === 'coins_purchase' ? '💰 Compra de Cero Coins'
          : n.type === 'coins_received' ? '◈ Cero Coins recibidas' : '◈ Transferencia realizada';
        const detail = n.amount
          ? `<span class="notif-meta">Monto: ◈ ${Number(n.amount).toLocaleString('es-AR')} CC</span>`
          : '';
        return `<div class="notif-item${unread}" data-id="${n.id}">
          <div class="notif-title">${title}</div>
          <div class="notif-body">${escapeHtml(n.body || '')}</div>
          ${detail}
          <button type="button" class="notif-btn notif-btn-muted" onclick="FriendsSocial.markNotifRead('${n.id}')">Entendido</button>
        </div>`;
      }
      if (n.type === 'friend_accepted') {
        return `<div class="notif-item${unread}" data-id="${n.id}">
          <div class="notif-title">✓ Amistad confirmada</div>
          <div class="notif-body">${escapeHtml(n.body || '')}</div>
          <button type="button" class="notif-btn notif-btn-muted" onclick="FriendsSocial.markNotifRead('${n.id}')">Entendido</button>
        </div>`;
      }
      if (n.type === 'friend_request') {
        return `<div class="notif-item${unread}" data-id="${n.id}">
          <div class="notif-title">👋 Solicitud de amistad</div>
          <div class="notif-body">${escapeHtml(n.fromName || 'Alguien')} quiere agregarte</div>
          <div class="notif-actions">
            <button type="button" class="notif-btn" onclick="FriendsSocial.acceptFriendRequest('${n.requestId}')">Aceptar</button>
            <button type="button" class="notif-btn notif-btn-muted" onclick="FriendsSocial.declineFriendRequest('${n.requestId}')">Rechazar</button>
          </div>
        </div>`;
      }
      return `<div class="notif-item${unread}"><div class="notif-body">${escapeHtml(n.body || n.title || '')}</div></div>`;
    }).join('');
  }

  async function _markNotifRead(notifId) {
    const hub = _hub();
    _syncUser();
    const myUid = _authUid() || _user?.uid;
    if (!hub || !myUid || !notifId) return;
    await hub.updateDoc(hub.doc(hub.db, 'users', myUid, 'notifications', notifId), { read: true });
  }

  async function notifyRoomInvite(targetUid, payload) {
    const hub = _hub();
    _syncUser();
    const myUid = _authUid() || _user?.uid;
    if (!hub || !myUid || !targetUid || targetUid === myUid) return;
    const game = payload.game || 'cero';
    const gameLbl = game === 'truco' ? 'Truco' : 'CERO';
    try {
      await _pushNotification(targetUid, {
        type: 'room_invite',
        title: `Invitación a ${gameLbl}`,
        body: `${payload.fromName || _user?.name || 'Un amigo'} te invitó a jugar (${payload.format || '1v1'})`,
        fromUid: payload.fromUid || myUid,
        fromName: payload.fromName || _user?.name || 'Jugador',
        roomId: payload.roomId,
        game,
        format: payload.format || '1v1',
        stakeCC: payload.stakeCC || 0,
        read: false,
      });
    } catch (e) {
      console.warn('[Friends] room invite notif:', e);
    }
  }

  async function notifyGlobalChat(text) {
    const hub = _hub();
    _syncUser();
    const myUid = _authUid() || _user?.uid;
    if (!hub || !myUid) return;
    const preview = String(text || '').trim().slice(0, 120);
    if (!preview) return;
    await refreshFriends();
    const targets = _friends.map(f => f.uid || f.id).filter(uid => uid && uid !== myUid).slice(0, 50);
    const fromName = _user?.name || 'Jugador';
    await Promise.all(targets.map(uid =>
      _pushNotification(uid, {
        type: 'chat_global',
        title: 'Chat global',
        body: `${fromName}: ${preview.slice(0, 80)}`,
        fromUid: myUid,
        fromName,
        preview,
        read: false,
      }).catch(() => {})
    ));
  }

  async function notifyCoins(targetUid, { type, amount, counterparty, code }) {
    const hub = _hub();
    _syncUser();
    const myUid = _authUid() || _user?.uid;
    if (!hub || !targetUid) return;
    const amt = Number(amount) || 0;
    let body = '';
    const amtStr = amt.toLocaleString('es-AR');
    if (type === 'coins_received') {
      body = `Recibiste ◈ ${amtStr} CC de ${counterparty || 'un jugador'}. Ya están en tu cuenta.`;
    } else if (type === 'coins_sent') {
      body = `Transferiste ◈ ${amtStr} CC a ${counterparty || 'un jugador'}. La operación se completó correctamente.`;
    } else if (type === 'coins_redeem') {
      body = `Canjeaste el código ${code || 'promo'} y sumaste ◈ ${amtStr} CC a tu saldo.`;
    } else if (type === 'coins_purchase') {
      body = `Acreditamos ◈ ${amtStr} CC en tu cuenta (${code || 'compra'}).`;
    }
    try {
      await _pushNotification(targetUid, {
        type,
        title: 'Cero Coins',
        body,
        amount: amt,
        counterparty: counterparty || null,
        code: code || null,
        read: false,
      });
    } catch (e) {
      console.warn('[Friends] coins notif:', e);
    }
  }

  function markNotifRead(notifId) {
    return _markNotifRead(notifId).then(() => {
      const item = (_lastNotifItems || []).find(n => n.id === notifId);
      if (item) item.read = true;
      _renderNotifList(_lastNotifItems || []);
      _updateAllBadges();
    });
  }

  function _flashProfileMsg(text, kind = 'ok', tab = 'amigos') {
    const id = tab === 'notificaciones' ? 'profileFlashMsg' : 'profileFlashMsgAmigos';
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = `profile-flash-msg is-${kind}`;
    el.hidden = false;
    clearTimeout(el._hideT);
    el._hideT = setTimeout(() => { el.hidden = true; }, 6000);
  }

  async function clearNotificationHistory() {
    const hub = _hub();
    _syncUser();
    const myUid = _authUid() || _user?.uid;
    if (!hub || !myUid) return;
    if (!confirm('¿Eliminar todo el historial de notificaciones? No se puede deshacer.')) return;

    try {
      const snap = await hub.getDocs(hub.collection(hub.db, 'users', myUid, 'notifications'));
      if (!snap.empty) {
        const batch = hub.writeBatch(hub.db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      _lastNotifItems = [];
      _renderNotifList([]);
      _updateAllBadges();
      _flashProfileMsg('Historial de notificaciones eliminado.', 'ok', 'notificaciones');
    } catch (e) {
      console.warn('[Friends] clear notifs:', e);
      alert('No se pudo limpiar el historial. Intentá de nuevo.');
    }
  }

  function openGlobalChatFromNotif(notifId) {
    if (notifId) _markNotifRead(notifId);
    if (typeof closeModal === 'function') closeModal('modalProfile');
    if (window.HubChat?.open) {
      HubChat.open();
      HubChat.switchTab('global');
    }
  }

  async function notifyChatMessage(targetUid, text) {
    const hub = _hub();
    _syncUser();
    const myUid = _authUid() || _user?.uid;
    if (!hub || !myUid || !targetUid || targetUid === myUid) return;
    const preview = String(text || '').trim().slice(0, 120);
    if (!preview) return;
    try {
      await _pushNotification(targetUid, {
        type: 'chat_dm',
        title: 'Mensaje privado',
        body: `${_user?.name || 'Alguien'}: ${preview.slice(0, 80)}`,
        fromUid: myUid,
        fromName: _user?.name || 'Jugador',
        preview,
        read: false,
      });
    } catch (e) {
      console.warn('[Friends] chat notif:', e);
    }
  }

  async function openChatFromNotif(fromUid, notifId) {
    if (notifId) await _markNotifRead(notifId);
    if (typeof closeModal === 'function') closeModal('modalProfile');
    if (window.HubChat?.open) {
      HubChat.open();
      HubChat.switchTab('private');
      setTimeout(() => {
        const sel = document.getElementById('hubChatFriendSelect');
        if (sel && fromUid) {
          sel.value = fromUid;
          HubChat.onFriendSelect(fromUid);
        }
      }, 150);
    }
  }

  function applyProfileTabIntent() {
    switchProfileTab(_profileTabIntent || 'perfil');
  }

  function switchProfileTab(tab) {
    _profileTab = tab || 'perfil';
    _profileTabIntent = _profileTab;
    document.querySelectorAll('.profile-hub-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.profileTab === _profileTab);
    });
    document.querySelectorAll('.profile-hub-panel').forEach(p => {
      p.classList.toggle('active', p.dataset.profilePanel === _profileTab);
    });
    if (_profileTab === 'amigos') _renderFriendsPanel();
    if (_profileTab === 'notificaciones') _renderNotifList(_lastNotifItems || []);
    if (_profileTab === 'stats' && typeof window.refreshProfileStats === 'function') window.refreshProfileStats();
    if (_profileTab === 'cuenta' && typeof window.refreshProfileCuenta === 'function') window.refreshProfileCuenta();
  }

  async function _markNotifReadByRequest(requestId) {
    const hub = _hub();
    _syncUser();
    const myUid = _authUid() || _user?.uid;
    if (!hub || !myUid || !requestId) return;
    const matches = (_lastNotifItems || []).filter(n => n.requestId === requestId && !n.read);
    await Promise.all(matches.map(n =>
      hub.updateDoc(hub.doc(hub.db, 'users', myUid, 'notifications', n.id), { read: true })
    ));
  }

  async function findMyActiveRoom(uid) {
    const hub = _hub();
    if (!hub || !uid) return null;
    try {
      const q = hub.query(
        hub.collection(hub.db, 'rooms'),
        hub.where('playerIds', 'array-contains', uid),
        hub.where('status', 'in', ['waiting', 'playing']),
        hub.limit(3)
      );
      const snap = await hub.getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, ...d.data() };
    } catch (e) {
      console.warn('[Friends] findMyActiveRoom:', e.message);
      return null;
    }
  }

  function _showRoomInvitePopup(n) {
    const el = document.getElementById('modalRoomInvite');
    if (!el) return;
    const gameLbl = n.game === 'truco' ? 'Truco' : 'CERO';
    const from = n.fromName || 'Un amigo';
    const fmt = n.format || '1v1';
    const stake = n.stakeCC ? ` · Pozo ◈ ${Number(n.stakeCC).toLocaleString('es-AR')} CC` : '';
    const title = document.getElementById('roomInviteTitle');
    const body = document.getElementById('roomInviteBody');
    const meta = document.getElementById('roomInviteMeta');
    if (title) title.textContent = `🎮 Invitación a ${gameLbl}`;
    if (body) body.textContent = `${from} te invita a jugar ${fmt}${stake}`;
    if (meta) meta.textContent = 'Aceptá para entrar a la sala al instante.';
    const accept = document.getElementById('roomInviteAccept');
    const decline = document.getElementById('roomInviteDecline');
    if (accept) {
      accept.onclick = () => {
        if (typeof closeModal === 'function') closeModal('modalRoomInvite');
        joinRoom(n.roomId, n.id).catch(err => alert(err.message || 'No se pudo unir'));
      };
    }
    if (decline) {
      decline.onclick = () => {
        if (n.id) _markNotifRead(n.id);
        if (typeof closeModal === 'function') closeModal('modalRoomInvite');
      };
    }
    if (typeof openModal === 'function') openModal('modalRoomInvite');
    else el.classList.add('active');
  }

  async function closeRoom(roomId, opts = {}) {
    const hub = _hub();
    _syncUser();
    if (!hub || !_user?.uid || !roomId) return;
    const roomRef = hub.doc(hub.db, 'rooms', roomId);
    const snap = await hub.getDoc(roomRef);
    if (!snap.exists()) return;
    const d = snap.data();
    const ids = d.playerIds || [];
    if (!ids.includes(_user.uid)) throw new Error('No estás en esta sala');

    if (d.status === 'playing') {
      if (window.RoomLifecycle) {
        await window.RoomLifecycle.leave(roomId, d.game || 'cero', _user.uid, { force: true });
      }
      if (window.RoomPrizes?.settle) await window.RoomPrizes.settle(roomId);
      return;
    }

    if (d.hostId === _user.uid) {
      try {
        if (window.RoomPrizes?.refundRoom) await window.RoomPrizes.refundRoom(roomId);
      } catch (e) {
        console.warn('[Friends] refund:', e);
      }
      await hub.updateDoc(roomRef, {
        status: 'finished',
        finishReason: 'closed_by_host',
        finishedAt: hub.serverTimestamp(),
        lastActivity: hub.serverTimestamp(),
      });
      return;
    }

    const players = (d.players || []).filter(p => p.uid !== _user.uid);
    const playerIds = ids.filter(id => id !== _user.uid);
    const patch = {
      players,
      playerIds,
      lastActivity: hub.serverTimestamp(),
    };
    if (playerIds.length === 0) {
      try {
        if (window.RoomPrizes?.refundRoom) await window.RoomPrizes.refundRoom(roomId);
      } catch (e) { console.warn('[Friends] refund:', e); }
      patch.status = 'finished';
      patch.finishReason = 'empty';
      patch.finishedAt = hub.serverTimestamp();
    } else if (d.status === 'waiting') {
      patch.status = 'waiting';
    }
    await hub.updateDoc(roomRef, patch);
  }

  async function joinOpenRoom(roomId) {
    return joinRoom(roomId, null);
  }

  function _makeJoinCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function _roomJoinLink(game, roomId, code) {
    const g = game === 'truco' ? 'truco' : 'cero';
    return `${location.origin}/?join=${g}&room=${roomId}&code=${code}`;
  }

  async function joinRoom(roomId, notifId, joinCode = null) {
    const hub = _hub();
    const uid = _authUid() || _loadUser()?.uid;
    _user = { ...(_loadUser() || {}), uid };
    if (!hub || !uid) {
      window.location.href = 'login.html';
      return;
    }
    const roomRef = hub.doc(hub.db, 'rooms', roomId);
    const snap = await hub.getDoc(roomRef);
    if (!snap.exists()) throw new Error('La sala ya no existe');
    const d = snap.data();

    if (d.isPrivate && !d.playerIds?.includes(_user.uid)) {
      const invited = (d.invitedUids || []).includes(_user.uid);
      const codeOk = joinCode && d.joinCode
        && String(joinCode).toUpperCase() === String(d.joinCode).toUpperCase();
      if (!invited && !codeOk) {
        throw new Error('Sala privada. Necesitás invitación o el link con código.');
      }
    }

    if (!d.playerIds?.includes(uid)) {
      const max = d.maxPlayers || 2;
      if ((d.playerIds?.length || 0) >= max) throw new Error('La sala está llena');
      const stake = d.stakeCC || 0;
      if (stake > 0 && window.RoomPrizes?.chargeStake) {
        await window.RoomPrizes.chargeStake(uid, roomId, stake);
      }
      const players = [...(d.players || []), { uid, name: _user.name || 'Jugador', photo: _user.photo || null }];
      await hub.updateDoc(roomRef, {
        players,
        playerIds: [...(d.playerIds || []), uid],
        [`ready_${uid}`]: true,
        lastActivity: hub.serverTimestamp(),
      });
    } else if (d.status === 'waiting') {
      await hub.updateDoc(roomRef, {
        [`ready_${uid}`]: true,
        lastActivity: hub.serverTimestamp(),
      });
    }

    if (notifId) await _markNotifRead(notifId);
    const game = d.game === 'truco' ? 'truco' : 'cero';
    if (game === 'cero') {
      const url = typeof buildCeroOnlineUrl === 'function'
        ? buildCeroOnlineUrl(roomId, uid, d)
        : `/games/cero/index.html?roomId=${roomId}&uid=${uid}&mode=${d.mode || 'classic'}&format=${d.format || '1v1'}&players=${d.maxPlayers || 2}&voice=${d.voice || 'fem'}`;
      window.location.href = url;
      return;
    }
    window.location.href = `/games/truco/index.html?roomId=${roomId}&uid=${uid}&pvp=1`;
  }

  async function createCeroRoomWithInvites(opts, inviteUids = []) {
    const hub = _hub();
    _user = _loadUser();
    if (!hub || !_user?.uid || _user.anon) {
      alert('Iniciá sesión para crear sala con amigos.');
      window.location.href = 'login.html';
      return;
    }

    const existing = await findMyActiveRoom(_user.uid);
    if (existing) {
      throw new Error('Ya tenés una sala abierta. Cerrala desde el panel inferior del hub.');
    }

    const format = opts.format || '1v1';
    const maxMap = { '1v1': 2, '2v2': 4, '3v3': 6 };
    const maxPlayers = maxMap[format] || parseInt(opts.players, 10) || 2;
    const stakeCC = window.RoomPrizes?.clampStake(opts.stakeCC) || 0;
    if (stakeCC > 0) {
      const bal = _user.coins ?? 0;
      if (bal < stakeCC) {
        throw new Error(`Necesitás al menos ◈ ${stakeCC.toLocaleString('es-AR')} CC para crear esta sala`);
      }
    }

    const roomRef = hub.doc(hub.collection(hub.db, 'rooms'));
    const hostPlayer = { uid: _user.uid, name: _user.name || 'Host', photo: _user.photo || null };
    const isPrivate = !!opts.isPrivate;
    const joinCode = isPrivate ? _makeJoinCode() : null;

    await hub.setDoc(roomRef, {
      game:        'cero',
      status:      'waiting',
      hostId:      _user.uid,
      hostName:    _user.name,
      format,
      mode:        opts.mode || 'classic',
      voice:       opts.voice || 'fem',
      maxPlayers,
      stakeCC,
      stakesPaid:  [],
      players:     [hostPlayer],
      playerIds:   [_user.uid],
      invitedUids: inviteUids.filter(uid => uid !== _user.uid),
      allowSpectate: opts.allowSpectate !== false,
      isPrivate,
      joinCode,
      isRanked:      !!opts.isRanked,
      [`ready_${_user.uid}`]: true,
      createdAt:   hub.serverTimestamp(),
      lastActivity: hub.serverTimestamp(),
      phase:       null,
      optsKey:     `c-${opts.mode || 'classic'}-${format}`,
    });

    const roomId = roomRef.id;
    if (stakeCC > 0 && window.RoomPrizes?.chargeStake) {
      await window.RoomPrizes.chargeStake(_user.uid, roomId, stakeCC);
    }

    const fromName = _user.name || 'Un amigo';
    const joinLink = joinCode ? _roomJoinLink('cero', roomId, joinCode) : null;

    const targets = inviteUids.filter(id => id && id !== _user.uid);
    await Promise.all(targets.map(id =>
      notifyRoomInvite(id, { game: 'cero', roomId, format, fromName, fromUid: _user.uid, stakeCC, joinLink }).catch(() => {})
    ));

    return { roomId, joinLink, joinCode, redirectUid: _user.uid };
  }

  async function joinRoomByLink(roomId, code) {
    return joinRoom(roomId, null, code);
  }

  async function createTrucoRoomWithInvites(opts, inviteUids = []) {
    const hub = _hub();
    _user = _loadUser();
    if (!hub || !_user?.uid || _user.anon) {
      alert('Iniciá sesión para crear sala con amigos.');
      window.location.href = 'login.html';
      return;
    }

    const existing = await findMyActiveRoom(_user.uid);
    if (existing) {
      throw new Error('Ya tenés una sala abierta. Cerrala desde el panel inferior del hub.');
    }

    const format = opts.mode || '1v1';
    const maxMap = { '1v1': 2, '2v2': 4, '3v3': 6 };
    const maxPlayers = maxMap[format] || 2;
    const stakeCC = window.RoomPrizes?.clampStake(opts.stakeCC) || 0;
    if (stakeCC > 0) {
      const bal = _user.coins ?? 0;
      if (bal < stakeCC) {
        throw new Error(`Necesitás al menos ◈ ${stakeCC.toLocaleString('es-AR')} CC para crear esta sala`);
      }
    }

    const roomRef = hub.doc(hub.collection(hub.db, 'rooms'));
    const hostPlayer = { uid: _user.uid, name: _user.name || 'Host', photo: _user.photo || null };
    const trucoOpts = {
      points: opts.points || '15',
      flor:   opts.flor || 'no',
      mode:   format,
      voice:  opts.voice || 'male',
    };

    await hub.setDoc(roomRef, {
      game: 'truco',
      status: 'waiting',
      hostId: _user.uid,
      hostName: _user.name,
      format,
      maxPlayers,
      stakeCC,
      stakesPaid: [],
      players: [hostPlayer],
      playerIds: [_user.uid],
      invitedUids: inviteUids.filter(uid => uid !== _user.uid),
      trucoOpts,
      [`ready_${_user.uid}`]: true,
      createdAt: hub.serverTimestamp(),
      lastActivity: hub.serverTimestamp(),
    });

    const roomId = roomRef.id;
    if (stakeCC > 0 && window.RoomPrizes?.chargeStake) {
      await window.RoomPrizes.chargeStake(_user.uid, roomId, stakeCC);
    }

    const fromName = _user.name || 'Un amigo';
    const targets = inviteUids.filter(id => id && id !== _user.uid);
    await Promise.all(targets.map(id =>
      notifyRoomInvite(id, { game: 'truco', roomId, format, fromName, fromUid: _user.uid, stakeCC }).catch(() => {})
    ));

    const q = new URLSearchParams({
      roomId,
      uid: _user.uid,
      pvp: '1',
      points: trucoOpts.points,
      flor: trucoOpts.flor,
      mode: trucoOpts.mode,
      voice: trucoOpts.voice,
    });
    window.location.href = `/games/truco/index.html?${q}`;
  }

  function setPendingInvites(uids) {
    _pendingInvites = [...uids];
    _renderCeroInviteGrid();
  }

  function getPendingInvites() {
    return [..._pendingInvites];
  }

  function toggleInvite(uid) {
    const i = _pendingInvites.indexOf(uid);
    if (i >= 0) _pendingInvites.splice(i, 1);
    else _pendingInvites.push(uid);
    _renderCeroInviteGrid();
    _renderFriendPickerSelection();
  }

  function inviteAllFriends() {
    _pendingInvites = _friends.map(f => f.uid || f.id).filter(Boolean);
    _renderCeroInviteGrid();
    _renderFriendPickerSelection();
  }

  function _updateInviteCount() {
    const el = document.getElementById('ceroInviteCount');
    if (!el) return;
    const n = _pendingInvites.length;
    el.textContent = n === 0
      ? 'Sin invitaciones — podés jugar solo o invitar después'
      : `${n} amigo${n !== 1 ? 's' : ''} invitado${n !== 1 ? 's' : ''}`;
  }

  async function renderCeroInviteGrid() {
    await refreshFriends();
    _renderCeroInviteGrid();
  }

  function _renderCeroInviteGrid() {
    const grids = [
      document.getElementById('ceroInviteGrid'),
      document.getElementById('trucoInviteGrid'),
    ].filter(Boolean);
    if (!grids.length) return;

    const tiles = _friends.map(f => {
      const uid = f.uid || f.id;
      const sel = _pendingInvites.includes(uid);
      const initial = (f.name || '?')[0].toUpperCase();
      return `<button type="button" class="invite-friend-tile${sel ? ' selected' : ''}" data-uid="${uid}" onclick="FriendsSocial.toggleInvite('${uid}')" title="${escapeHtml(f.name || '')}">
        <span class="ift-avatar">${initial}</span>
        <span class="ift-name">${escapeHtml((f.name || 'Amigo').split(' ')[0])}</span>
        ${sel ? '<span class="ift-check">✓</span>' : ''}
      </button>`;
    }).join('');

    const addHtml = (game) => `
      <button type="button" class="invite-add-tile" onclick="FriendsSocial.openInvitePicker('${game}')" title="Buscar amigo">
        <span class="invite-add-icon">+</span>
        <span class="invite-add-lbl">Invitar</span>
      </button>`;
    grids.forEach(grid => {
      const game = grid.id === 'trucoInviteGrid' ? 'truco' : 'cero';
      grid.innerHTML = tiles + addHtml(game);
    });
    _updateInviteCount();
  }

  async function openInvitePicker(game) {
    _invitePickerGame = game || 'cero';
    await refreshFriends();
    _renderFriendPicker();
    openModal('modalInviteFriends');
  }

  function _renderFriendPicker() {
    const el = document.getElementById('friendPickerList');
    if (!el) return;
    if (!_friends.length) {
      el.innerHTML = '<p class="invite-hint">Agregá amigos desde el botón Amigos en el menú.</p>';
      return;
    }
    el.innerHTML = _friends.map(f => {
      const uid = f.uid || f.id;
      const sel = _pendingInvites.includes(uid) ? ' selected' : '';
      return `<button type="button" class="friend-pick-row${sel}" data-uid="${uid}" onclick="FriendsSocial.toggleInvite('${uid}')">
        <span class="fpr-avatar">${(f.name || '?')[0]}</span>
        <span class="fpr-name">${escapeHtml(f.name || 'Amigo')}</span>
        <span class="fpr-add">${sel ? '✓' : '+'}</span>
      </button>`;
    }).join('');
  }

  function _renderFriendPickerSelection() {
    _renderFriendPicker();
    _renderCeroInviteGrid();
  }

  async function renderDockFriends() {
    _user = _loadUser();
    const codeEl = document.getElementById('dockFriendCode');
    if (_user?.uid && ! _user.anon && codeEl) {
      codeEl.textContent = await ensureFriendCode(_user.uid) || '------';
    }
    await refreshFriends();
    const el = document.getElementById('dockFriendsList');
    if (!el) return;
    if (_user?.anon) {
      el.innerHTML = '<p class="invite-hint">Registrate para agregar amigos.</p>';
      return;
    }
    if (!_friends.length) {
      el.innerHTML = '<p class="invite-hint">Agregá con el código de 6 letras.</p>';
      return;
    }
    el.innerHTML = _friends.map(f => `
      <div class="friend-row">
        <span class="fpr-avatar">${(f.name || '?')[0]}</span>
        <span class="fpr-name">${escapeHtml(f.name || 'Amigo')}</span>
      </div>`).join('');
  }

  async function addFriendByCodeFromDock() {
    const input = document.getElementById('dockFriendCodeInput');
    const err = document.getElementById('dockFriendAddError');
    if (!input) return;
    const prev = document.getElementById('friendCodeInput');
    if (prev) prev.value = input.value;
    await addFriendByCode();
    if (err && document.getElementById('friendAddError')?.textContent) {
      err.textContent = document.getElementById('friendAddError').textContent;
      err.style.color = document.getElementById('friendAddError').style.color;
    }
    input.value = '';
    renderDockFriends();
  }

  async function openProfileHub(tab = 'perfil') {
    _syncUser();
    const myUid = _authUid() || _user?.uid;
    const hub = _hub();
    if (!myUid || !hub) {
      alert('Iniciá sesión para ver tu perfil.');
      window.location.href = 'login.html';
      return;
    }
    let targetTab = tab || 'perfil';
    if (hub.auth?.currentUser?.isAnonymous && targetTab !== 'perfil') {
      alert('Creá una cuenta registrada para amigos y notificaciones.');
      targetTab = 'perfil';
    }
    _profileTabIntent = targetTab;
    _user = { ...(_user || {}), uid: myUid };
    if (targetTab === 'amigos' || targetTab === 'notificaciones') {
      const codeEl = document.getElementById('myFriendCode');
      if (codeEl) {
        const code = await ensureFriendCode(myUid);
        codeEl.textContent = code || '------';
      }
      await refreshFriends();
      await refreshPendingRequests();
      _renderFriendsPanel();
    }
    if (_lastNotifItems.length || targetTab === 'notificaciones') {
      _renderNotifList(_lastNotifItems || []);
    }
    switchProfileTab(targetTab);
    if (typeof openModal === 'function') openModal('modalProfile');
    else document.getElementById('modalProfile')?.classList.add('active');
    applyProfileTabIntent();
    if (window.ProfileAvatar?.initModal) {
      setTimeout(() => window.ProfileAvatar.initModal(), 0);
    }
    if (targetTab === 'notificaciones') {
      setTimeout(() => {
        document.querySelector('[data-profile-panel="notificaciones"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 80);
    }
    if (targetTab === 'amigos' && _pendingRequests.length) {
      setTimeout(() => {
        document.getElementById('friendsPendingSection')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 120);
    }
  }

  async function openFriendsModal() {
    return openProfileHub('amigos');
  }

  function _renderPendingRequests() {
    const el = document.getElementById('friendsPendingList');
    const section = document.getElementById('friendsPendingSection');
    if (!el) return;
    if (!_pendingRequests.length) {
      el.innerHTML = '<p class="invite-hint">No tenés solicitudes nuevas</p>';
      if (section) section.classList.remove('has-pending');
      return;
    }
    if (section) section.classList.add('has-pending');
    el.innerHTML = _pendingRequests.map(r => `
      <div class="friend-request-row">
        <span class="fpr-avatar">${escapeHtml((r.fromName || '?')[0])}</span>
        <div class="frr-info">
          <span class="frr-name">${escapeHtml(r.fromName || 'Jugador')}</span>
          <span class="frr-meta">Quiere ser tu amigo/a</span>
        </div>
        <div class="frr-actions">
          <button type="button" class="notif-btn" onclick="FriendsSocial.acceptFriendRequest('${r.id}')">Aceptar</button>
          <button type="button" class="notif-btn notif-btn-muted" onclick="FriendsSocial.declineFriendRequest('${r.id}')">Rechazar</button>
        </div>
      </div>`).join('');
  }

  function _renderFriendsPanel() {
    _renderPendingRequests();
    _renderFriendsList();
  }

  function _renderFriendsList() {
    const el = document.getElementById('friendsList');
    if (!el) return;
    if (!_friends.length) {
      el.innerHTML = '<p class="invite-hint">Buscá amigos con su código de 6 letras.</p>';
      return;
    }
    el.innerHTML = _friends.map(f => {
      const uid = f.uid || f.id;
      return `<div class="friend-row">
        <span class="fpr-avatar">${(f.name || '?')[0]}</span>
        <span class="fpr-name">${escapeHtml(f.name || 'Amigo')}</span>
        <button type="button" class="notif-btn notif-btn-muted friend-chat-btn" onclick="FriendsSocial.openChatFromNotif('${uid}', '')">Chat</button>
      </div>`;
    }).join('');
  }

  async function addFriendByCode() {
    const input = document.getElementById('friendCodeInput');
    const err = document.getElementById('friendAddError');
    if (!input) return;
    _syncUser();
    if (!_authUid()) {
      if (err) {
        err.style.color = '#f87171';
        err.textContent = 'Iniciá sesión de nuevo para agregar amigos.';
      }
      return;
    }
    const code = input.value.trim().toUpperCase();
    if (err) err.textContent = '';
    try {
      const found = await searchByCode(code);
      if (!found) throw new Error('Código no encontrado');
      await sendFriendRequest(found.uid, found.name);
      if (err) { err.style.color = '#4ade80'; err.textContent = `Solicitud enviada a ${found.name}`; }
      input.value = '';
    } catch (e) {
      console.warn('[Friends] addFriendByCode:', e?.code, e?.message);
      const msg = (e?.code === 'permission-denied')
        ? 'Permiso denegado. Cerrá sesión, volvé a entrar y probá otra vez.'
        : (e.message || 'Error al agregar');
      if (err) { err.style.color = '#f87171'; err.textContent = msg; }
    }
  }

  function openNotifications() {
    return openProfileHub('notificaciones');
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return {
    init,
    refreshFriends,
    getFriends,
    searchByCode,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    createCeroRoomWithInvites,
    createTrucoRoomWithInvites,
    joinRoom,
    openInvitePicker,
    openProfileHub,
    switchProfileTab,
    applyProfileTabIntent,
    openFriendsModal,
    openNotifications,
    notifyChatMessage,
    notifyGlobalChat,
    notifyRoomInvite,
    notifyCoins,
    markNotifRead,
    clearNotificationHistory,
    openGlobalChatFromNotif,
    openChatFromNotif,
    setPendingInvites,
    getPendingInvites,
    toggleInvite,
    addFriendByCode,
    addFriendByCodeFromDock,
    joinOpenRoom,
    joinRoomByLink,
    closeRoom,
    findMyActiveRoom,
    ensureFriendCode,
    renderCeroInviteGrid,
    renderDockFriends,
    inviteAllFriends,
  };
})();

window.FriendsSocial = FriendsSocial;

window.openProfileHub = function openProfileHub(tab) {
  if (window.FriendsSocial?.openProfileHub) {
    FriendsSocial.openProfileHub(tab || 'perfil').catch(err => {
      console.warn('[Friends] openProfileHub:', err);
      alert(err?.message || 'No se pudo abrir el perfil. Recargá la página.');
    });
    return;
  }
  if (typeof openModal === 'function') openModal('modalProfile');
};

window.openFriendsHub = function openFriendsHub() {
  openProfileHub('amigos');
};

window.openAlertsHub = function openAlertsHub() {
  openProfileHub('notificaciones');
};

function _bootFriendsSocial() {
  if (!window.FBHub) return;
  FriendsSocial.init().catch(console.warn);
}

(function waitFb() {
  if (window.FBHub) {
    _bootFriendsSocial();
    return;
  }
  setTimeout(waitFb, 200);
})();

window.addEventListener('fb:profileReady', _bootFriendsSocial);
window.addEventListener('fb:hubReady', _bootFriendsSocial);
