/**
 * Cero Club — Online Multiplayer Cero via Firestore
 * Loaded when URL has ?roomId=xxx
 *
 * Game state lives in:
 *   rooms/{roomId}          — public state (phase, turn, discard, counts)
 *   rooms/{roomId}/hands/{uid} — private hand (only owner reads)
 *
 * NOTE (Phase 3): game validation will move to Colyseus server.
 * For now, client enforces rules via transactions.
 */

'use strict';

/* global createCeroDeck, canPlayOn, canStackOn, isWild, COLOR_CSS, cardDisplayValue,
          buildCeroCard, renderCero, _applyFanLayout */

const TURN_SECONDS = 15;
const AFK_MAX_STRIKES = 3;

const ONLINE_PHASE = {
  WAITING:    'waiting',
  DEALING:    'dealing',
  MY_TURN:    'my_turn',
  OPP_TURN:   'opp_turn',
  COLOR_PICK: 'color_pick',
  GAME_OVER:  'game_over',
};

function _friendlyCeroError(e) {
  const msg = e?.message || String(e || '');
  if (/stored version|aborted|contention|failed-precondition/i.test(msg)) {
    return 'La mesa se actualizó. Intentá de nuevo.';
  }
  if (/permission|PERMISSION_DENIED/i.test(msg)) {
    return 'Sin permiso en esta sala. Recargá con Ctrl+F5.';
  }
  if (/No es tu turno/i.test(msg)) return msg;
  return msg || 'No se pudo completar la jugada';
}

async function _runTxRetry(db, fn, tries = 6) {
  const runTransaction = window.FBHub?.runTransaction;
  if (!runTransaction) throw new Error('Firebase no listo');
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await runTransaction(db, fn);
    } catch (e) {
      last = e;
      if (!/stored version|aborted|contention|failed-precondition/i.test(e?.message || '') || i >= tries - 1) {
        throw e;
      }
      await new Promise(r => setTimeout(r, 60 * (i + 1)));
    }
  }
  throw last;
}

class CeroOnlineGame {
  constructor(roomId, myUid, opts, onStateChange) {
    this.roomId     = roomId;
    this.myUid      = myUid;
    this.opts       = opts;
    this.onChange   = onStateChange;
    this.voice      = typeof VoiceSystem !== 'undefined'
                        ? new VoiceSystem(opts.voice || 'fem')
                        : null;

    this._db        = null;
    this._unsubs    = [];
    this._myCards   = [];
    this._roomData  = null;
    this.myIndex    = -1;
    this.isHost     = false;
    this.phase      = ONLINE_PHASE.WAITING;
    this.pendingCard = null;
    this._dealing   = false;   // prevents double-deal race
    this._busy      = false;
    this._matchFinalized = false;
    this._turnSyncKey = '';
    this._dealError = null;
    this._turnTimeoutHandled = 0;
    this._emitPending = false;
  }

  // ── Init ───────────────────────────────────────────────────────────
  async init() {
    const hub = window.FBHub;
    if (!hub) throw new Error('Firebase not ready');
    this._db = hub.db;

    const { doc, getDoc, onSnapshot, updateDoc, serverTimestamp } = hub;
    const roomRef = doc(this._db, 'rooms', this.roomId);

    // Load initial room state
    const snap = await getDoc(roomRef);
    if (!snap.exists()) throw new Error('Sala no encontrada');
    const data = snap.data();

    this._roomData = data;
    this.opts = {
      ...this.opts,
      mode:   _sanitizeMode(data.mode || this.opts.mode),
      format: data.format || this.opts.format || '1v1',
      voice:  data.voice  || this.opts.voice  || 'fem',
    };
    this.myIndex   = (data.playerIds || []).indexOf(this.myUid);
    if (this.myIndex === -1) {
      this.myIndex = (data.players || []).findIndex(p => p.uid === this.myUid);
    }

    if (this.myIndex === -1) {
      const ids = data.playerIds || [];
      if (ids.length < (data.maxPlayers || 2) && !ids.includes(this.myUid)) {
        const players = [...(data.players || []), {
          uid: this.myUid,
          name: _playerLabel() || 'Jugador',
          photo: null,
        }];
        await updateDoc(roomRef, {
          players,
          playerIds: [...ids, this.myUid],
          [`ready_${this.myUid}`]: true,
          lastActivity: serverTimestamp(),
        });
        this.myIndex = players.length - 1;
        this._roomData = { ...data, players, playerIds: [...ids, this.myUid] };
      } else {
        throw new Error('No estás en esta sala');
      }
    }

    this.isHost = (this._roomData.hostId === this.myUid)
      || (this.myIndex === 0 && !this._roomData.hostId);

    // Mark player as ready
    const readyField = `ready_${this.myUid}`;
    await updateDoc(roomRef, {
      [readyField]:  true,
      lastActivity:  serverTimestamp(),
    });

    // Subscribe to room updates
    const unsubRoom = onSnapshot(roomRef, snap => {
      const d = snap.data();
      if (d) this._onRoomUpdate(d);
    });
    this._unsubs.push(unsubRoom);

    // Subscribe to my hand
    const handRef = doc(this._db, 'rooms', this.roomId, 'hands', this.myUid);
    const unsubHand = onSnapshot(handRef, snap => {
      this._myCards = snap.data()?.cards || [];
      this._emitState();
    });
    this._unsubs.push(unsubHand);

    if (this.isHost && window.CeroHostServer) {
      CeroHostServer.bindHost(this);
    }

    this._emitState();
    this._tryStartDeal();
  }

  _tryStartDeal() {
    const d = this._roomData;
    if (!d || d.status !== 'waiting' || d.phase) return;
    const ids = d.playerIds || [];
    const maxP = d.maxPlayers || 2;
    const need = Math.min(maxP, Math.max(2, ids.length));
    const allReady = ids.length >= need &&
      ids.every(uid => d[`ready_${uid}`] === true);
    const dealStale = d.dealingBy && Date.now() - (d.dealingAt || 0) > 45000;
    if (allReady && !this._dealing && (!d.dealingBy || dealStale)) {
      void this._attemptDeal();
    }
  }

  // ── Room state handler ─────────────────────────────────────────────
  _onRoomUpdate(data) {
    this._roomData = data;
    this._reconnecting = false;
    this._reconnectMsg  = null;

    const idx = (data.playerIds || []).indexOf(this.myUid);
    if (idx >= 0) this.myIndex = idx;
    else {
      const pidx = (data.players || []).findIndex(p => p.uid === this.myUid);
      if (pidx >= 0) this.myIndex = pidx;
    }

    const players = _orderedPlayers(data);

    if (data.status === 'finished') {
      if (!this._matchFinalized) {
        this._matchFinalized = true;
        void this._finalizeMatch(data);
      }
      this.phase = ONLINE_PHASE.GAME_OVER;
      this._emitState();
      return;
    }

    for (const p of players) {
      if (p.uid === this.myUid) continue;
      const left = data.leftPlayers?.[p.uid];
      if (!left) continue;

      if (left.rejoinUntil && Date.now() < left.rejoinUntil) {
        this._reconnecting = true;
        this._reconnectMsg  = `${p.name} se desconectó. Reconexión (${Math.ceil((left.rejoinUntil - Date.now()) / 1000)}s)...`;
        break;
      }
    }

    if (this.isHost && data.status === 'playing') {
      for (const p of players) {
        if (p.uid === this.myUid) continue;
        const left = data.leftPlayers?.[p.uid];
        if (left) {
          if (left.rejoinUntil && Date.now() < left.rejoinUntil) continue;
          if (left.leaving && !left.rejoinUntil) continue;
          void this._forfeitOpponent(p.uid);
          return;
        }
      }
    }

    // Cualquier jugador puede iniciar el reparto cuando todos están listos
    if (data.status === 'waiting' && !data.phase) {
      const ids = data.playerIds || [];
      const maxP = data.maxPlayers || 2;
      const minStart = Math.min(maxP, Math.max(2, ids.length));
      const allReady = ids.length >= minStart &&
        ids.every(uid => data[`ready_${uid}`] === true);
      const dealStale = data.dealingBy && Date.now() - (data.dealingAt || 0) > 45000;

      if (allReady && !this._dealing && (!data.dealingBy || dealStale)) {
        void this._attemptDeal();
        return;
      }
      if (this._dealing || data.dealingBy) {
        this._emitState();
        return;
      }
      this._emitState();
      return;
    }

    if (this.isHost && data.status === 'playing' && !data.winner) {
      const syncKey = `${data.currentTurn}-${data.turnDeadline}-${data.lastAction?.type || ''}`;
      if (this._turnSyncKey !== syncKey) {
        this._turnSyncKey = syncKey;
        if (window.iniciarTurnoTimer) void iniciarTurnoTimer(this);
      }
    }

    this._emitState();
  }

  async _finalizeMatch(data) {
    const stake = data.stakeCC || 0;
    if (stake > 0 && !data.prizeSettled && window.RoomPrizes?.settle) {
      await window.RoomPrizes.settle(this.roomId).catch(() => {});
    }
    if (window.MatchRewards?.applyMyReward) {
      await window.MatchRewards.applyMyReward(this.roomId, data).catch(() => {});
    }
    if (this.voice) {
      const won = (data.winner || data.forfeit?.winnerUid) === this.myUid;
      if (won) this.voice.say('¡Ganaste!');
    }
  }

  async _attemptDeal() {
    if (this._dealing) return;
    this._dealing = true;
    this._dealError = null;
    this._emitState();

    const hub = window.FBHub;
    const { doc, runTransaction, deleteField } = hub;
    const roomRef = doc(this._db, 'rooms', this.roomId);

    try {
      const claimed = await runTransaction(this._db, async tx => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) return false;
        const d = snap.data();
        if (d.status !== 'waiting' || d.phase) return false;
        if (d.dealingBy && Date.now() - (d.dealingAt || 0) < 45000) return false;
        tx.update(roomRef, { dealingBy: this.myUid, dealingAt: Date.now() });
        return true;
      });

      if (!claimed) {
        this._dealing = false;
        this._emitState();
        return;
      }

      await this._hostDeal();
      this._dealing = false;
    } catch (err) {
      console.error('[CeroOnline] Deal error:', err);
      this._dealing = false;
      this._dealError = _friendlyCeroError(err) || 'No se pudo repartir. Recargá la página.';
      try {
        await hub.updateDoc(roomRef, { dealingBy: deleteField(), dealingAt: deleteField() });
      } catch (_) { /* ignore */ }
      this._emitState();
    }
  }

  // ── Host: deal cards ───────────────────────────────────────────────
  async _hostDeal() {
    const hub = window.FBHub;
    const { doc, setDoc, updateDoc, writeBatch, serverTimestamp, deleteField } = hub;

    const mode    = _sanitizeMode(this._roomData.mode || this.opts.mode);
    const deck    = createCeroDeck(mode);
    const ids     = this._roomData.playerIds || [];
    const players = _orderedPlayers(this._roomData);
    if (players.length < 2) throw new Error('Faltan jugadores en la sala');

    const hands = {};
    players.forEach(p => { hands[p.uid] = []; });

    // Shuffle and deal 7 cards each
    for (let i = 0; i < 7; i++) {
      for (const p of players) {
        hands[p.uid].push(deck.pop());
      }
    }

    // Flip first non-wild card
    let first = deck.pop();
    let safety = 0;
    while ((isWild(first) || first.type === 'cero_special') && safety++ < 50) {
      deck.push(first);
      first = deck.pop();
    }

    const handCounts = {};
    players.forEach(p => { handCounts[p.uid] = hands[p.uid].length; });

    // Batch write: room state + all hands
    const batch = writeBatch(this._db);

    for (const p of players) {
      const handRef = doc(this._db, 'rooms', this.roomId, 'hands', p.uid);
      batch.set(handRef, { cards: hands[p.uid] });
    }

    const roomRef = doc(this._db, 'rooms', this.roomId);
    batch.update(roomRef, {
      status:      'playing',
      phase:       'my_turn',
      mode,
      players,
      playerIds:   ids,
      currentTurn: 0,
      direction:   1,
      drawStack:   0,
      ..._deckRoomPatch(deck, [first], { color: first.color }),
      handCounts,
      winner:      null,
      startedAt:   serverTimestamp(),
      turnDeadline: Date.now() + TURN_SECONDS * 1000,
      turnSeconds:  TURN_SECONDS,
      afkStrikes:   {},
      ceroCalled:   {},
      puedeCantarCero: null,
      ceroForgot:   null,
      matchScore:  { p0: 0, p1: 0 },
      dealingBy:    deleteField(),
      dealingAt:    deleteField(),
    });

    await batch.commit();
    this._dealing = false;
    if (window.iniciarTurnoTimer) await iniciarTurnoTimer(this);
    this.voice?.say('¡Comienza el juego!');
  }

  // ── Build public state for UI ──────────────────────────────────────
  _emitState() {
    if (!this._roomData) return;
    if (this._emitPending) return;
    this._emitPending = true;
    requestAnimationFrame(() => {
      this._emitPending = false;
      this._emitStateNow();
    });
  }

  _emitStateNow() {
    if (!this._roomData) return;
    const d = this._roomData;
    const players = _orderedPlayers(d);

    let localPhase;
    if (!d.phase || d.status === 'waiting') {
      localPhase = ONLINE_PHASE.WAITING;
    } else if (d.winner) {
      localPhase = ONLINE_PHASE.GAME_OVER;
    } else if (d.phase === 'color_pick' && d.currentTurn === this.myIndex) {
      localPhase = ONLINE_PHASE.COLOR_PICK;
    } else {
      localPhase = d.currentTurn === this.myIndex
        ? ONLINE_PHASE.MY_TURN
        : ONLINE_PHASE.OPP_TURN;
    }
    this.phase = localPhase;

    const discardTop = d.discardTop || null;
    const myCards    = this._myCards;
    const playable   = localPhase === ONLINE_PHASE.MY_TURN && discardTop
      ? myCards.filter(c => canPlayOn(c, discardTop, d.color, d.drawStack, myCards))
      : [];
    const playableIds = playable.map(c => String(c.id));

    const oppCards = [];
    for (let i = 0; i < players.length; i++) {
      if (i !== this.myIndex) {
        const uid = players[i].uid;
        oppCards.push({ name: players[i].name, count: d.handCounts?.[uid] || 0, index: i });
      }
    }

    if (this._reconnecting && d.status !== 'playing') {
      localPhase = ONLINE_PHASE.WAITING;
    }

    const playerNames = players.map((p, i) =>
      i === this.myIndex ? (_playerLabel() || 'Vos') : (p.name || `Rival ${i}`)
    );

    this.onChange({
      phase:       localPhase,
      hands:       this._buildHandsArray(d, myCards),
      realHands:   this._buildHandsArray(d, myCards),
      discard:     discardTop ? [discardTop] : [],
      color:       d.color || 'blue',
      current:     d.currentTurn ?? 0,
      direction:   d.direction ?? 1,
      drawStack:   d.drawStack ?? 0,
      winner:      d.winner ?? null,
      playerCount: players.length,
      maxPlayers:  d.maxPlayers || 2,
      mode:        d.mode || 'classic',
      format:      d.format || '1v1',
      mirror:      d.mirror || false,
      ceroSaid:    d.ceroSaid || [],
      playerNames,
      matchScore:  d.matchScore || { p0: 0, p1: 0 },
      turnDeadline: d.turnDeadline || null,
      turnSeconds: d.turnSeconds || TURN_SECONDS,
      puedeCantarCero: d.puedeCantarCero || null,
      ceroCalled: d.ceroCalled || {},
      ceroForgot: d.ceroForgot || null,
      afkStrikes: d.afkStrikes || {},
      _myAfkStrikes: d.afkStrikes?.[this.myUid] || 0,
      _online:     true,
      _myIndex:    this.myIndex,
      _players:    players,
      _handCounts: d.handCounts || {},
      _localPhase: localPhase,
      _playable:   playableIds,
      deckCount:   d.deckCount ?? 0,
      _waiting:    d.status === 'waiting',
      _reconnectMsg: this._reconnectMsg || null,
      _dealError:  this._dealError || null,
      _dealing:    this._dealing || !!(d.dealingBy && d.status === 'waiting'),
    });
  }

  async _forfeitOpponent(oppUid) {
    const hub = window.FBHub;
    if (!hub || !this.isHost) return;
    const { doc, updateDoc, serverTimestamp } = hub;
    await updateDoc(doc(this._db, 'rooms', this.roomId), {
      status:       'finished',
      winner:       this.myUid,
      phase:        'game_over',
      finishReason: 'disconnect',
      forfeit:      { uid: oppUid, winnerUid: this.myUid, at: Date.now() },
      lastActivity: serverTimestamp(),
    });
    if (window.RoomPrizes?.settle) {
      await window.RoomPrizes.settle(this.roomId).catch(() => {});
    }
    this.voice?.say('Rival abandonó. ¡Ganaste!');
  }

  _buildHandsArray(d, myCards) {
    const players = _orderedPlayers(d);
    const result  = [];
    for (let i = 0; i < players.length; i++) {
      if (i === this.myIndex) {
        result.push(myCards);
      } else {
        const uid   = players[i].uid;
        const count = d.handCounts?.[uid] || 0;
        result.push(Array(count).fill(null));
      }
    }
    return result;
  }

  // ── Player actions ─────────────────────────────────────────────────
  async sayCero() {
    if (this._busy) return;
    const d = this._roomData;
    if (d.puedeCantarCero !== this.myUid && this._myCards.length !== 1) return;

    const hub = window.FBHub;
    const { db, doc, updateDoc } = hub;
    const cc = { ...(d.ceroCalled || {}), [this.myUid]: true };
    await updateDoc(doc(db, 'rooms', this.roomId), {
      ceroCalled: cc,
      ceroForgot: null,
    });
    this._roomData = { ...d, ceroCalled: cc, ceroForgot: null };
    this.voice?.say('¡CERO!');
    this.voice?.sfx('cero');
    this._emitState();
  }

  /** Rival denuncia que no dijo CERO antes de la última carta. */
  async denunciarNoDijoCero() {
    if (this._busy) return;
    const d = this._roomData;
    const infractor = d.ceroForgot;
    if (!infractor || infractor === this.myUid) return;

    const hub = window.FBHub;
    const { db, doc, runTransaction, serverTimestamp } = hub;
    const roomRef = doc(db, 'rooms', this.roomId);
    const handRef = doc(db, 'rooms', this.roomId, 'hands', infractor);
    this._busy = true;
    try {
      await runTransaction(db, async tx => {
        const roomSnap = await tx.get(roomRef);
        const rd = roomSnap.data();
        if (rd.ceroForgot !== infractor) return;

        const handSnap = await tx.get(handRef);
        let { cards: deck, discard } = _readDeckFromRoom(rd);
        let hand = handSnap.data()?.cards || [];

        if (!deck.length && discard.length > 1) {
          const top = discard.pop();
          deck = _shuffle([...discard]);
          discard = [top];
        }
        const drawn = deck.splice(Math.max(0, deck.length - 2), 2);
        hand = [...hand, ...drawn];

        tx.update(handRef, { cards: hand });
        tx.update(roomRef, {
          ceroForgot: null,
          puedeCantarCero: infractor,
          status: rd.winner ? 'finished' : 'playing',
          winner: null,
          phase: 'opp_turn',
          [`handCounts.${infractor}`]: hand.length,
          ..._deckRoomPatch(deck, discard),
          lastAction: { type: 'cero_penalty', uid: this.myUid, target: infractor, at: serverTimestamp() },
        });
      });
      this.voice?.say('¡No dijo CERO! +2 cartas');
      if (this.isHost && window.iniciarTurnoTimer) await iniciarTurnoTimer(this);
    } catch (e) {
      alert(e.message || 'No se pudo aplicar la penalidad');
    } finally {
      this._busy = false;
    }
  }

  // ── Player actions ─────────────────────────────────────────────────
  getPlayBlockReason(cardId) {
    if (this._busy) return 'Procesando la jugada anterior…';
    if (this.phase !== ONLINE_PHASE.MY_TURN) return 'No es tu turno';
    const card = this._myCards.find(c => String(c.id) === String(cardId));
    if (!card) return 'Esa carta ya no está en tu mano';
    const d = this._roomData || {};
    const mustSayCero = this._myCards.length === 1 && !d.ceroCalled?.[this.myUid];
    const fn = window.playBlockReason;
    if (!fn) return 'Reglas del juego no cargadas — recargá con Ctrl+F5';
    return fn(card, d.discardTop, d.color, d.drawStack ?? 0, this._myCards, { mustSayCero });
  }

  canPlayCardId(cardId) {
    return this.getPlayBlockReason(cardId) === null;
  }

  async playCard(cardId) {
    const block = this.getPlayBlockReason(cardId);
    if (block) {
      _ceroStatusHint(block);
      return false;
    }
    const card = this._myCards.find(c => String(c.id) === String(cardId));
    if (!card) return false;
    const d = this._roomData;

    if (this._myCards.length === 1 && !d.ceroCalled?.[this.myUid]) {
      _ceroStatusHint('¡Tenés que apretar CERO! antes de tirar tu última carta.');
      return false;
    }

    const hub = window.FBHub;
    const { db, doc, runTransaction, serverTimestamp } = hub;
    const roomRef = doc(db, 'rooms', this.roomId);
    const handRef = doc(db, 'rooms', this.roomId, 'hands', this.myUid);
    const cid = String(cardId);

    const newHand = this._myCards.filter(c => String(c.id) !== cid);
    const next = this._computeNextStateFor(card, newHand.length, this.myIndex);
    const strikes = { ...(d.afkStrikes || {}) };
    strikes[this.myUid] = 0;

    let ceroForgot = d.ceroForgot;
    let puedeCantarCero = d.puedeCantarCero;
    if (newHand.length === 1) {
      puedeCantarCero = this.myUid;
      ceroForgot = null;
    } else if (newHand.length === 0 && !d.ceroCalled?.[this.myUid]) {
      delete next.status;
      delete next.winner;
      next.phase = 'opp_turn';
      ceroForgot = this.myUid;
      puedeCantarCero = null;
    }

    this._busy = true;
    try {
      await _runTxRetry(db, async tx => {
        const [roomSnap, handSnap] = await Promise.all([tx.get(roomRef), tx.get(handRef)]);
        if (!roomSnap.exists()) throw new Error('La sala no existe');
        const rd = roomSnap.data();
        if (rd.currentTurn !== this.myIndex) throw new Error('No es tu turno');
        if (rd.drawStack > 0 && !canStackOn(card, rd.discardTop)) {
          throw new Error('Tenés que robar las cartas pendientes o apilar +2/+4');
        }
        if (!rd.deckCards && !rd.discardTop) throw new Error('El mazo aún no está listo');

        const liveHand = handSnap.data()?.cards || [];
        if (!canPlayOn(card, rd.discardTop, rd.color, rd.drawStack, liveHand)) {
          throw new Error('Esa carta no coincide en color, número o símbolo.');
        }
        if (!liveHand.some(c => String(c.id) === cid)) {
          throw new Error('Esa carta ya no está en tu mano');
        }
        const txNewHand = liveHand.filter(c => String(c.id) !== cid);
        const txNext = this._computeNextStateFor(card, txNewHand.length, this.myIndex);

        let { cards: deck, discard } = _readDeckFromRoom(rd);
        discard = [...discard, card];
        tx.update(handRef, { cards: txNewHand });
        tx.update(roomRef, {
          ...txNext,
          ..._deckRoomPatch(deck, discard, {
            color: isWild(card) ? rd.color : activeColor(card, rd.color),
          }),
          [`handCounts.${this.myUid}`]: txNewHand.length,
          afkStrikes: strikes,
          puedeCantarCero,
          ceroForgot,
          timeoutHandled: null,
          turnDeadline: Date.now() + TURN_SECONDS * 1000,
          turnSeconds: TURN_SECONDS,
          lastAction:  { type: 'play', uid: this.myUid, card, handBefore: this._myCards.length, at: serverTimestamp() },
        });
      });

      this._myCards = newHand;
      this._roomData = { ...this._roomData, ...next, afkStrikes: strikes, puedeCantarCero, ceroForgot };
      this._turnTimeoutHandled = 0;
      this._emitState();

      if (newHand.length === 0 && ceroForgot) {
        this.voice?.say('¡Última carta! El rival puede denunciar si no dijiste CERO');
      } else {
        this._voiceForCard(card, newHand.length);
      }
      if (next.status === 'finished' && !ceroForgot && window.RoomPrizes?.settle) {
        await window.RoomPrizes.settle(this.roomId).catch(() => {});
      }
      if (this.isHost && window.iniciarTurnoTimer) await iniciarTurnoTimer(this);
      return true;
    } catch (e) {
      _ceroStatusHint(_friendlyCeroError(e));
      return false;
    } finally {
      this._busy = false;
    }
  }

  _voiceForCard(card, handLeft) {
    if (!this.voice) return;
    const v = card.value;
    if (v === 'draw2') { this.voice.say('¡Más dos!'); this.voice.sfx('skip'); return; }
    if (v === 'wild4') { this.voice.say('¡Más cuatro!'); this.voice.sfx('wild'); return; }
    if (v === 'skip') { this.voice.say('¡Saltá turno!'); this.voice.sfx('skip'); return; }
    if (v === 'reverse') { this.voice.say('¡Cambio de sentido!'); this.voice.sfx('reverse'); return; }
    if (v === 'wild') { this.voice.say('¡Comodín!'); this.voice.sfx('wild'); return; }
    if (v === 'cero_star') { this.voice.say('¡Cero estrella!'); this.voice.sfx('wild'); return; }
    this.voice.sfx(isWild(card) ? 'wild' : 'play');
    if (handLeft === 1) this.voice.say('¡Última carta!');
    if (handLeft === 0) { this.voice.say('¡CERO!'); this.voice.sfx('cero'); }
  }

  async drawCard() {
    if (this._busy || this.phase !== ONLINE_PHASE.MY_TURN) return;
    const hub = window.FBHub;
    if (!hub?.db) return;
    const { db, doc, getDoc, runTransaction, serverTimestamp } = hub;
    const roomRef = doc(db, 'rooms', this.roomId);
    const handRef = doc(db, 'rooms', this.roomId, 'hands', this.myUid);
    this._busy = true;
    let drawN = 1;
    try {
      await _runTxRetry(db, async tx => {
        const [roomSnap, handSnap] = await Promise.all([tx.get(roomRef), tx.get(handRef)]);
        if (!roomSnap.exists()) throw new Error('La sala no existe');
        const rd = roomSnap.data();
        if (!rd.deckCards && !rd.discardTop) throw new Error('El mazo aún no está listo');
        if (rd.currentTurn !== this.myIndex) throw new Error('No es tu turno');

        let { cards: deck, discard } = _readDeckFromRoom(rd);
        let currentHand = handSnap.data()?.cards || [];
        const players = _orderedPlayers(rd);
        const n = players.length || rd.playerIds?.length || 2;

        drawN = rd.drawStack > 0 ? rd.drawStack : 1;
        if (!deck?.length && discard?.length > 1) {
          const top = discard.pop();
          deck = _shuffle([...discard]);
          discard = [top];
        }
        if (!deck?.length) throw new Error('No hay cartas en el mazo');

        const drawn = deck.splice(Math.max(0, deck.length - drawN), drawN);
        currentHand = [...currentHand, ...drawn];

        const dir = rd.direction ?? 1;
        const top = rd.discardTop;
        const lastOne = drawN === 1 ? drawn[0] : null;
        const canPlayDrawn = drawN === 1 && lastOne &&
          canPlayOn(lastOne, top, rd.color, 0, currentHand);
        const nextTurn = canPlayDrawn
          ? rd.currentTurn
          : (rd.currentTurn + dir + n * 10) % n;
        const nextPhase = canPlayDrawn ? 'my_turn' : 'opp_turn';

        tx.update(handRef, { cards: currentHand });
        const strikes = { ...(rd.afkStrikes || {}) };
        strikes[this.myUid] = 0;
        const nextUid = players[nextTurn]?.uid;
        const nextCount = nextUid === this.myUid ? currentHand.length : (rd.handCounts?.[nextUid] ?? 0);

        tx.update(roomRef, {
          drawStack:   0,
          currentTurn: nextTurn,
          phase:       nextPhase,
          ..._deckRoomPatch(deck, discard || []),
          turnDeadline: Date.now() + TURN_SECONDS * 1000,
          turnSeconds: TURN_SECONDS,
          afkStrikes: strikes,
          timeoutHandled: null,
          puedeCantarCero: nextCount === 1 ? nextUid : null,
          [`handCounts.${this.myUid}`]: currentHand.length,
          lastAction:  { type: 'draw', uid: this.myUid, count: drawN, mayPlay: canPlayDrawn, at: serverTimestamp() },
        });
      });

      const [handSnap, roomSnap] = await Promise.all([getDoc(handRef), getDoc(roomRef)]);
      this._myCards = handSnap.data()?.cards || [];
      if (roomSnap.exists()) this._roomData = { ...this._roomData, ...roomSnap.data() };
      this._emitState();

      if (drawN > 1) this.voice?.say(`Robás ${drawN} cartas`);
      else if (this.phase === ONLINE_PHASE.MY_TURN) {
        this.voice?.sfx('draw');
        _ceroStatusHint('Robaste 1 carta — si te sirve, podés jugarla ahora.');
      } else {
        this.voice?.sfx('draw');
      }
    } catch (e) {
      console.warn('[CeroOnline] draw:', e);
      _ceroStatusHint(_friendlyCeroError(e));
    } finally {
      this._busy = false;
    }
  }

  async pickColor(color) {
    if (this.phase !== ONLINE_PHASE.COLOR_PICK) return;
    const hub = window.FBHub;
    const { db, doc, updateDoc, serverTimestamp } = hub;
    const d = this._roomData;
    const pendingCard = d.pendingCard;
    const nextState = this._finishWildEffect(pendingCard, color, d, this.myIndex);

    await updateDoc(doc(db, 'rooms', this.roomId), {
      ...nextState,
      color,
      phase:       'opp_turn',
      pendingCard: null,
      turnDeadline: Date.now() + TURN_SECONDS * 1000,
      turnSeconds: TURN_SECONDS,
      timeoutHandled: null,
    });
    if (this.isHost && window.iniciarTurnoTimer) await iniciarTurnoTimer(this);
    this.voice?.say(`Color ${COLOR_CSS[color]?.label || color}`);
  }

  // ── Compute next game state after playing a card ───────────────────
  _computeNextState(card, newHandSize) {
    return this._computeNextStateFor(card, newHandSize, this.myIndex);
  }

  _computeNextStateFor(card, newHandSize, playerIdx) {
    const d = this._roomData;
    const players = _orderedPlayers(d);
    const uid = players[playerIdx]?.uid;

    if (newHandSize === 0) {
      return { status: 'finished', winner: uid, phase: 'game_over' };
    }

    if (isWild(card) && card.value !== 'cero_mirror') {
      return {
        discardTop:  card,
        phase:       'color_pick',
        pendingCard: card,
        currentTurn: playerIdx,
      };
    }

    return {
      discardTop: card,
      color:      card.color || d.color,
      phase:      'opp_turn',
      ...this._applyCardEffectsFor(card, d, playerIdx),
    };
  }

  _applyCardEffects(card, d) {
    return this._applyCardEffectsFor(card, d, this.myIndex);
  }

  _applyCardEffectsFor(card, d, playerIdx) {
    const players = _orderedPlayers(d);
    const n       = players.length || d.playerIds?.length || 2;
    const myIdx  = playerIdx;
    let direction = d.direction;
    let drawStack = d.drawStack;
    let nextTurn;

    switch (card.value) {
      case 'skip':
        nextTurn = (myIdx + direction * 2 + n * 2) % n;
        break;
      case 'reverse':
        direction *= -1;
        // En 1v1 la Reverse funciona como Skip: volvés a jugar vos.
        nextTurn = n === 2 ? myIdx : (myIdx + direction + n * 2) % n;
        break;
      case 'draw2':
        drawStack += 2;
        nextTurn = (myIdx + direction + n) % n;
        break;
      case 'wild4':
        drawStack += 4;
        nextTurn = (myIdx + direction + n) % n;
        break;
      default:
        nextTurn = (myIdx + direction + n) % n;
    }

    return {
      direction,
      drawStack,
      currentTurn: nextTurn,
      turnDeadline: Date.now() + TURN_SECONDS * 1000,
      turnSeconds: TURN_SECONDS,
    };
  }

  onTurnTimeout() {
    const dl = this._roomData?.turnDeadline || 0;
    if (dl && this._turnTimeoutHandled === dl) return;
    if (dl) this._turnTimeoutHandled = dl;

    if (this.isHost && window.CeroHostServer) {
      void CeroHostServer.hostAutoTurn(this);
      return;
    }
    if (this._busy || this.phase !== ONLINE_PHASE.MY_TURN) return;
    this.drawCard().catch(() => {});
  }

  _finishWildEffect(card, color, d, playerIdx) {
    const players = _orderedPlayers(d);
    const n       = players.length || d.playerIds?.length || 2;
    const myIdx  = playerIdx ?? d.currentTurn ?? this.myIndex;
    const nextTurn = (myIdx + d.direction + n) % n;
    let drawStack = d.drawStack;
    if (card?.value === 'wild4') drawStack += 4;
    return { currentTurn: nextTurn, drawStack, direction: d.direction };
  }

  // ── Destroy ────────────────────────────────────────────────────────
  destroy(opts = {}) {
    if (window.CeroHostServer) CeroHostServer.stopHost();
    if (!opts.skipLeave && window.RoomLifecycle) {
      RoomLifecycle.leave(this.roomId, 'cero', this.myUid).catch(() => {});
    }
    if (window.RoomLifecycle) RoomLifecycle.unbind();
    this._unsubs.forEach(u => u());
    this._unsubs = [];
  }

  toggleMute() {
    if (!this.voice) return false;
    this.voice.enabled = !this.voice.enabled;
    return this.voice.enabled;
  }
}

// ── Shuffle helper (same as in cards.js) ──────────────────────────────────────
function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function _ceroStatusHint(msg) {
  const el = document.getElementById('statusBanner');
  if (el && msg) el.textContent = msg;
}

function _sanitizeMode(mode) {
  return mode === 'cero' ? 'cero' : 'classic';
}

/** Mazo en el doc de la sala (evita permisos rotos en _server/deck). */
function _readDeckFromRoom(rd) {
  if (!rd) return { cards: [], discard: [] };
  if (Array.isArray(rd.deckCards)) {
    return {
      cards: [...rd.deckCards],
      discard: [...(rd.discardPile || (rd.discardTop ? [rd.discardTop] : []))],
    };
  }
  return { cards: [], discard: rd.discardTop ? [rd.discardTop] : [] };
}

function _deckRoomPatch(cards, discard, extra = {}) {
  const top = discard[discard.length - 1] || null;
  const patch = {
    deckCards: cards,
    discardPile: discard,
    discardTop: top,
    deckCount: cards.length,
    ...extra,
  };
  if (top?.color && top.color !== 'wild') patch.color = top.color;
  return patch;
}

function _orderedPlayers(d) {
  const ids = d?.playerIds || [];
  const nameMap = Object.fromEntries((d?.players || []).map(p => [p.uid, p]));
  if (ids.length) {
    return ids.map(uid => nameMap[uid] || { uid, name: 'Jugador', photo: null });
  }
  return d?.players || [];
}

function _playerLabel() {
  try {
    const u = JSON.parse(sessionStorage.getItem('cero_user') || '{}');
    return u.displayName || u.name || 'Vos';
  } catch (_) {
    return 'Vos';
  }
}

window.CeroOnlineGame = CeroOnlineGame;
window._ceroOrderedPlayers = _orderedPlayers;
window._readCeroDeckFromRoom = _readDeckFromRoom;
window._ceroDeckRoomPatch = _deckRoomPatch;
