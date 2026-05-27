'use strict';

/**
 * Salida de sala: Truco = cierre + puntos al rival.
 * Cero = ventana de reconexión si tiene Cero Coins; si no, forfeit.
 */
const RoomLifecycle = (() => {
  const CERO_REJOIN_MS = 90_000;
  let _boundRoom = null;

  function uniquePlayerIds(ids) {
    return [...new Set((ids || []).filter(Boolean))];
  }

  function _playersForIds(ids, players) {
    const nameMap = Object.fromEntries((players || []).map(p => [p.uid, p]));
    return ids.map(id => nameMap[id] || { uid: id, name: 'Jugador', photo: null });
  }

  function _hasRejoinCoins(game) {
    if (game === 'cero') return true;
    try {
      const u = JSON.parse(sessionStorage.getItem('cero_user') || '{}');
      return (u.coins ?? 0) > 0;
    } catch (_) { return false; }
  }

  async function leave(roomId, game, uid, opts = {}) {
    const fb = window.FBHub;
    if (!fb?.db || !roomId || !uid) return;

    const roomRef = fb.doc(fb.db, 'rooms', roomId);
    const snap    = await fb.getDoc(roomRef);
    if (!snap.exists()) return;

    const d       = snap.data();
    const ids     = d.playerIds || (d.players || []).map(p => p.uid);
    if (!ids.includes(uid)) return;

    const winnerUid = ids.find(id => id !== uid);
    const now       = Date.now();

    if (game === 'cero' && _hasRejoinCoins(game) && !opts.force) {
      await fb.updateDoc(roomRef, {
        [`leftPlayers.${uid}`]: { at: now, rejoinUntil: now + CERO_REJOIN_MS },
        lastActivity: fb.serverTimestamp(),
      });
      return;
    }

    const patch = {
      status:       'finished',
      finishedAt:   fb.serverTimestamp(),
      finishReason: opts.force ? 'abandon' : 'disconnect',
      winner:       winnerUid || null,
      forfeit: {
        uid,
        winnerUid: winnerUid || null,
        at:        now,
      },
      lastActivity: fb.serverTimestamp(),
    };

    if (game === 'truco' && d.trucoOpts) {
      const pts = d.trucoOpts.points === 30 ? 30 : 15;
      const cur = d.trucoPvp?.score || { player: 0, cpu: 0 };
      const hostId = d.hostId || ids[0];
      const guestId = ids.find(id => id !== hostId);
      const score = { player: cur.player ?? 0, cpu: cur.cpu ?? 0 };
      if (uid === hostId) score.player = pts;
      else if (uid === guestId) score.cpu = pts;
      else if (uid === ids[0]) score.player = pts;
      else score.cpu = pts;
      patch.trucoPvp = { ...(d.trucoPvp || {}), score, lastAction: { action: 'forfeit', seq: Date.now(), at: now } };
    }

    await fb.updateDoc(roomRef, patch);
    if (window.RoomPrizes?.settle) {
      await window.RoomPrizes.settle(roomId).catch(() => {});
    }
  }

  function bindUnload(roomId, game, uid) {
    if (!roomId || !uid) return;
    _boundRoom = { roomId, game, uid };

    // Cero online: no marcar abandono al recargar/cerrar pestaña (rompe la partida).
    // El host aplica forfeit solo si leftPlayers expira o el jugador usa "Salir".
    if (game === 'cero') return;

    const handler = () => {
      const { roomId: rid, game: g, uid: u } = _boundRoom;
      leave(rid, g, u).catch(() => {});
    };

    window.addEventListener('pagehide', handler);
    window.addEventListener('beforeunload', handler);
  }

  function unbind() { _boundRoom = null; }

  /** Cero: ¿puede volver a entrar? */
  async function canRejoin(roomId, uid) {
    const fb = window.FBHub;
    if (!fb?.db) return false;
    const snap = await fb.getDoc(fb.doc(fb.db, 'rooms', roomId));
    if (!snap.exists()) return false;
    const left = snap.data()?.leftPlayers?.[uid];
    if (!left?.rejoinUntil) return false;
    return Date.now() < left.rejoinUntil;
  }

  async function clearLeft(roomId, uid) {
    const fb = window.FBHub;
    if (!fb?.db) return;
    await fb.updateDoc(fb.doc(fb.db, 'rooms', roomId), {
      [`leftPlayers.${uid}`]: fb.deleteField(),
      [`ready_${uid}`]: true,
      lastActivity: fb.serverTimestamp(),
    });
  }

  /** Join or rejoin a room atomically (dedupes playerIds, clears leftPlayers). */
  async function joinOrRejoin(roomId, uid, player = {}) {
    const fb = window.FBHub;
    if (!fb?.db || !roomId || !uid) throw new Error('Datos incompletos');

    const roomRef = fb.doc(fb.db, 'rooms', roomId);
    return fb.runTransaction(fb.db, async tx => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error('La sala ya no existe');

      const d = snap.data();
      let ids = uniquePlayerIds(d.playerIds);
      const max = d.maxPlayers || 2;
      const patch = {
        lastActivity: fb.serverTimestamp(),
        [`ready_${uid}`]: true,
      };

      if (ids.includes(uid)) {
        if (d.leftPlayers?.[uid]) {
          patch[`leftPlayers.${uid}`] = fb.deleteField();
        }
        if ((d.playerIds || []).length !== ids.length) {
          patch.playerIds = ids;
          patch.players = _playersForIds(ids, d.players);
        }
        tx.update(roomRef, patch);
        return { kind: 'rejoin', data: d };
      }

      if (d.status !== 'waiting') throw new Error('La sala ya empezó o terminó');
      if (ids.length >= max) throw new Error('La sala está llena');

      const players = [...(d.players || [])];
      if (!players.some(p => p.uid === uid)) {
        players.push({
          uid,
          name: player.name || 'Jugador',
          photo: player.photo || null,
        });
      }
      ids = [...ids, uid];
      patch.players = players;
      patch.playerIds = ids;
      tx.update(roomRef, patch);
      return { kind: 'join', data: d };
    });
  }

  return {
    leave,
    bindUnload,
    unbind,
    canRejoin,
    clearLeft,
    joinOrRejoin,
    uniquePlayerIds,
    CERO_REJOIN_MS,
  };
})();

window.RoomLifecycle = RoomLifecycle;
