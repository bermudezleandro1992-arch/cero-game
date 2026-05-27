'use strict';

/**
 * Puntos de ranking y XP por partida (gratis en beta — sin Cero Coins).
 * Cada jugador aplica SU propio premio (Firestore solo permite editar tu perfil).
 */
const MatchRewards = (() => {
  const WIN_XP = 25;
  const LOSS_XP = 8;
  const WIN_RANK = 15;
  const LOSS_RANK = -5;

  function _hub() { return window.FBHub?.db ? window.FBHub : null; }

  function _myUid() {
    return window.FBHub?.auth?.currentUser?.uid
      || JSON.parse(sessionStorage.getItem('cero_user') || 'null')?.uid
      || null;
  }

  async function applyMyReward(roomId, roomData) {
    const hub = _hub();
    const uid = _myUid();
    if (!hub || !uid || !roomId || !roomData || roomData.status !== 'finished') return;

    const winnerUid = roomData.winner || roomData.forfeit?.winnerUid;
    const ids = roomData.playerIds || [];
    if (!winnerUid || !ids.includes(uid)) return;

    const flag = `reward_${uid}`;
    if (roomData[flag]) return;

    const isWinner = uid === winnerUid;
    const game = roomData.game === 'truco' ? 'truco' : 'cero';
    const { db, doc, getDoc, updateDoc, runTransaction, increment } = hub;
    const roomRef = doc(db, 'rooms', roomId);
    const userRef = doc(db, 'users', uid);

    try {
      await runTransaction(db, async tx => {
        const roomSnap = await tx.get(roomRef);
        if (!roomSnap.exists()) return;
        const rd = roomSnap.data();
        if (rd[flag] || rd.status !== 'finished') return;

        if (isWinner) {
          tx.update(userRef, {
            wins: increment(1),
            gamesPlayed: increment(1),
            [`wins_${game}`]: increment(1),
            [`games_${game}`]: increment(1),
            xp: increment(WIN_XP),
            rankPoints: increment(WIN_RANK),
            [`rankPoints_${game}`]: increment(WIN_RANK),
          });
        } else {
          const userSnap = await tx.get(userRef);
          const d = userSnap.data() || {};
          tx.update(userRef, {
            gamesPlayed: increment(1),
            [`games_${game}`]: increment(1),
            xp: increment(LOSS_XP),
            rankPoints: Math.max(0, (d.rankPoints ?? 0) + LOSS_RANK),
            [`rankPoints_${game}`]: Math.max(0, (d[`rankPoints_${game}`] ?? 0) + LOSS_RANK),
          });
        }
        tx.update(roomRef, { [flag]: true });
      });
      _syncSession(uid, isWinner);
    } catch (e) {
      console.warn('[MatchRewards]', e);
    }
  }

  /** Compat: delega en applyMyReward (cada cliente aplica lo suyo). */
  async function applyFromRoom(roomId, roomData) {
    return applyMyReward(roomId, roomData);
  }

  function _syncSession(uid, isWinner) {
    const hub = _hub();
    if (!hub) return;
    hub.getDoc(hub.doc(hub.db, 'users', uid)).then(snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      try {
        const sess = JSON.parse(sessionStorage.getItem('cero_user') || 'null');
        if (sess?.uid === uid) {
          sess.coins = d.coins ?? sess.coins;
          sess.xp = d.xp ?? sess.xp;
          sess.wins = d.wins ?? sess.wins;
          sess.gamesPlayed = d.gamesPlayed ?? sess.gamesPlayed;
          sess.rankPoints = d.rankPoints ?? sess.rankPoints;
          sess.wins_cero = d.wins_cero ?? sess.wins_cero;
          sess.wins_truco = d.wins_truco ?? sess.wins_truco;
          sess.rankPoints_cero = d.rankPoints_cero ?? sess.rankPoints_cero;
          sess.rankPoints_truco = d.rankPoints_truco ?? sess.rankPoints_truco;
          sessionStorage.setItem('cero_user', JSON.stringify(sess));
        }
      } catch (_) { /* ignore */ }
      if (window._fbUser?.uid === uid) {
        Object.assign(window._fbUser, {
          coins: d.coins,
          xp: d.xp,
          wins: d.wins,
          gamesPlayed: d.gamesPlayed,
          rankPoints: d.rankPoints,
          rankPoints_cero: d.rankPoints_cero,
          rankPoints_truco: d.rankPoints_truco,
        });
      }
      if (typeof window.syncCoinsUI === 'function') window.syncCoinsUI();
      if (typeof window.refreshProfileStats === 'function') window.refreshProfileStats();
      if (typeof window.renderRanking === 'function') {
        window.renderRanking(window._rankingGameFilter || 'all');
      }
      _toastReward(isWinner);
    }).catch(() => {});
  }

  function _toastReward(isWinner) {
    const el = document.getElementById('statusBanner');
    if (!el) return;
    const msg = isWinner
      ? `🏆 ¡Ganaste! +${WIN_RANK} pts ranking · +${WIN_XP} XP`
      : `Partida terminada · ${LOSS_RANK} pts · +${LOSS_XP} XP`;
    el.textContent = msg;
    el.classList.add(isWinner ? 'status-myturn' : '');
  }

  return { WIN_XP, LOSS_XP, WIN_RANK, LOSS_RANK, applyMyReward, applyFromRoom };
})();

window.MatchRewards = MatchRewards;
