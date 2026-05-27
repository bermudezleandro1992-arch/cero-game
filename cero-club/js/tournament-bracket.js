'use strict';

/**
 * Utilidades de bracket para torneos 1v1 (potencia de 2).
 */
window.TournamentBracket = {
  nextPow2(n) {
    let p = 2;
    while (p < n) p *= 2;
    return Math.min(p, 32);
  },

  roundLabels(size) {
    if (size <= 2) return ['Final'];
    if (size <= 4) return ['Semifinal', 'Final'];
    if (size <= 8) return ['Cuartos', 'Semifinal', 'Final'];
    if (size <= 16) return ['Octavos', 'Cuartos', 'Semifinal', 'Final'];
    return ['R1', 'R2', 'R3', 'R4', 'Final'];
  },

  build(players, maxSlots) {
    const size = this.nextPow2(Math.min(maxSlots || 8, players.length || 1));
    const slots = players.slice(0, size);
    while (slots.length < size) {
      slots.push({ uid: null, displayName: 'BYE', bye: true });
    }
    const labels = this.roundLabels(size);
    const rounds = [];
    let current = [];
    for (let i = 0; i < size; i += 2) {
      const p1 = slots[i];
      const p2 = slots[i + 1];
      const byeWin = p1.bye ? p2.uid : p2.bye ? p1.uid : null;
      current.push({
        id: `r1-m${i / 2}`,
        p1: { uid: p1.uid, displayName: p1.displayName || '—' },
        p2: { uid: p2.uid, displayName: p2.displayName || '—' },
        winnerUid: byeWin,
        status: byeWin ? 'done' : 'pending',
      });
    }
    rounds.push({ round: 1, label: labels[0] || 'R1', matches: current });

    let r = 2;
    let prev = current;
    while (prev.length > 1) {
      const matches = [];
      for (let i = 0; i < prev.length; i += 2) {
        const a = prev[i];
        const b = prev[i + 1];
        const w1 = a?.winnerUid || null;
        const w2 = b?.winnerUid || null;
        let winnerUid = null;
        if (w1 && !w2) winnerUid = w1;
        else if (w2 && !w1) winnerUid = w2;
        matches.push({
          id: `r${r}-m${i / 2}`,
          p1: { uid: w1, displayName: _nameFromPrev(a, w1) },
          p2: { uid: w2, displayName: _nameFromPrev(b, w2) },
          winnerUid,
          status: winnerUid ? 'done' : 'pending',
        });
      }
      rounds.push({ round: r, label: labels[r - 1] || `R${r}`, matches });
      prev = matches;
      r += 1;
    }
    return { size, rounds, championUid: prev[0]?.winnerUid || null };
  },

  setWinner(bracket, matchId, winnerUid) {
    if (!bracket?.rounds) return bracket;
    const b = JSON.parse(JSON.stringify(bracket));
    let foundRound = -1;
    let foundIdx = -1;
    b.rounds.forEach((rd, ri) => {
      rd.matches.forEach((m, mi) => {
        if (m.id === matchId) {
          m.winnerUid = winnerUid;
          m.status = 'done';
          foundRound = ri;
          foundIdx = mi;
        }
      });
    });
    if (foundRound < 0) return b;
    _propagate(b, foundRound, foundIdx);
    const last = b.rounds[b.rounds.length - 1];
    b.championUid = last?.matches?.[0]?.winnerUid || null;
    return b;
  },
};

function _nameFromPrev(match, uid) {
  if (!uid || !match) return '—';
  if (match.p1?.uid === uid) return match.p1.displayName || '—';
  if (match.p2?.uid === uid) return match.p2.displayName || '—';
  return '—';
}

function _propagate(b, roundIdx, matchIdx) {
  const nextRound = b.rounds[roundIdx + 1];
  if (!nextRound) return;
  const nextMatchIdx = Math.floor(matchIdx / 2);
  const slot = matchIdx % 2;
  const m = b.rounds[roundIdx].matches[matchIdx];
  const nm = nextRound.matches[nextMatchIdx];
  if (!nm) return;
  const winner = {
    uid: m.winnerUid,
    displayName: m.winnerUid === m.p1?.uid ? m.p1.displayName : m.p2?.displayName,
  };
  if (slot === 0) nm.p1 = winner;
  else nm.p2 = winner;
  if (nm.p1?.uid && nm.p2?.uid) {
    nm.winnerUid = null;
    nm.status = 'pending';
  }
}
