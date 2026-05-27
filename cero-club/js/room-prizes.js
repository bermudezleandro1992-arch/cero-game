'use strict';

/**
 * Pozo de Cero Coins en salas privadas (800 – 20.000 CC).
 */
const RoomPrizes = (() => {
  const STAKE_MIN = 800;
  const STAKE_MAX = 20_000;

  function _hub() {
    const h = window.FBHub;
    if (!h?.db) return null;
    return h;
  }

  function clampStake(n) {
    const v = parseInt(n, 10) || 0;
    if (v <= 0) return 0;
    return Math.min(STAKE_MAX, Math.max(STAKE_MIN, v));
  }

  async function chargeStake(uid, roomId, stakeCC) {
    const hub = _hub();
    if (!hub || !uid || !roomId || !stakeCC) return;
    const { db, doc, getDoc, updateDoc, increment } = hub;
    const roomRef = hub.doc(db, 'rooms', roomId);
    const userRef = hub.doc(db, 'users', uid);

    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) throw new Error('La sala no existe');
    const paid = roomSnap.data().stakesPaid || [];
    if (paid.includes(uid)) return;

    const userSnap = await getDoc(userRef);
    const coins = userSnap.data()?.coins ?? 0;
    if (coins < stakeCC) {
      throw new Error(`Necesitás al menos ◈ ${stakeCC.toLocaleString('es-AR')} CC para esta sala`);
    }

    await updateDoc(userRef, { coins: increment(-stakeCC) });
    await updateDoc(roomRef, { stakesPaid: [...paid, uid] });
    _syncSessionCoins(uid);
  }

  async function refundRoom(roomId) {
    const hub = _hub();
    if (!hub || !roomId) return;
    const { db, doc, getDoc, updateDoc, increment } = hub;
    const roomRef = hub.doc(db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;
    const d = roomSnap.data();
    if (d.prizeSettled || d.refunded) return;

    const stake = d.stakeCC || 0;
    const paid = d.stakesPaid || [];
    if (!stake || !paid.length) {
      await updateDoc(roomRef, { refunded: true });
      return;
    }

    for (const uid of paid) {
      await updateDoc(hub.doc(db, 'users', uid), { coins: increment(stake) });
      _syncSessionCoins(uid);
    }
    await updateDoc(roomRef, { refunded: true, stakesPaid: [] });
  }

  async function settle(roomId) {
    const hub = _hub();
    if (!hub || !roomId) return;
    const { db, doc, getDoc, updateDoc, increment, serverTimestamp } = hub;
    const roomRef = hub.doc(db, 'rooms', roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return;
    const d = snap.data();
    if (d.prizeSettled) return;

    const stake = d.stakeCC || 0;
    const paid = d.stakesPaid || [];
    let winnerUid = d.winner || d.forfeit?.winnerUid || null;
    if (!winnerUid && paid.length === 1) winnerUid = paid[0];

    const pot = stake * paid.length;
    if (winnerUid && pot > 0) {
      await updateDoc(hub.doc(db, 'users', winnerUid), { coins: increment(pot) });
      _syncSessionCoins(winnerUid);
    }

    await updateDoc(roomRef, {
      prizeSettled: true,
      prizePot: pot,
      prizeWinner: winnerUid || null,
      lastActivity: serverTimestamp(),
    });

    if (winnerUid && pot > 0 && window.FriendsSocial?.notifyCoins) {
      const myUid = JSON.parse(sessionStorage.getItem('cero_user') || '{}')?.uid;
      if (myUid === winnerUid) {
        FriendsSocial.notifyCoins(winnerUid, {
          type: 'coins_received',
          amount: pot,
          counterparty: 'Pozo de la sala',
        }).catch(() => {});
      }
      if (typeof window.syncCoinsUI === 'function') window.syncCoinsUI();
    }
  }

  function _syncSessionCoins(uid) {
    const hub = _hub();
    if (!hub || !uid) return;
    hub.getDoc(hub.doc(hub.db, 'users', uid)).then(snap => {
      if (!snap.exists()) return;
      const coins = snap.data().coins ?? 0;
      try {
        const sess = JSON.parse(sessionStorage.getItem('cero_user') || 'null');
        if (sess?.uid === uid) {
          sess.coins = coins;
          sessionStorage.setItem('cero_user', JSON.stringify(sess));
        }
      } catch (_) { /* ignore */ }
      if (window._fbUser?.uid === uid) window._fbUser.coins = coins;
      if (typeof window.syncCoinsUI === 'function') window.syncCoinsUI();
    }).catch(() => {});
  }

  return { STAKE_MIN, STAKE_MAX, clampStake, chargeStake, refundRoom, settle };
})();

window.RoomPrizes = RoomPrizes;
