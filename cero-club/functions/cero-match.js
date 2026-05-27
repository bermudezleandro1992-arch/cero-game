'use strict';

/**
 * CERO — Módulo 2: Lógica de Backend (Cloud Functions)
 *
 * Funciones exportadas:
 *   joinMatch  — verifica elegibilidad, descuenta coins, crea/ingresa a partida
 *   playTurn   — ejecuta una acción de juego dentro de una transacción atómica
 *   forfeitMatch — abandono voluntario; entrega la victoria al rival
 *
 * Arquitectura de colecciones:
 *   users/{uid}                      — perfil y wallet
 *   matches/{matchId}                — estado público (para onSnapshot del cliente)
 *   matches/{matchId}/private/server — estado privado (deck, discard completo, todas las manos)
 *   matches/{matchId}/hands/{uid}    — mano del jugador (solo él puede leer)
 *
 * Seguridad: los clientes NUNCA pueden escribir en matches ni en private/server.
 * Las Cloud Functions usan el SDK Admin (bypasea las Security Rules).
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { CeroEngine, PHASE } = require('./cero-engine');

// ─────────────────────────────────────────────────────────────────────────────
// Configuración del negocio
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  FREE_GAMES_LIMIT: 2,       // partidas gratis para usuarios nuevos
  ENTRY_COST_CC:    50,      // costo en Cero Coins para partidas pagas
  HAND_SIZE:        7,       // cartas por jugador
  TURN_SECONDS:     30,      // tiempo límite por turno (segundos)
  MAX_PLAYERS:      2,       // para extender a 4 cambiar aquí
  REGION:           'us-central1',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Lanza HttpsError si la condición es falsa. */
function guard(condition, code, message) {
  if (!condition) throw new HttpsError(code, message);
}

/** Garantiza que el campo existe y es del tipo esperado. */
function requireField(data, field, type) {
  if (data[field] === undefined || data[field] === null) {
    throw new HttpsError('invalid-argument', `Falta el campo "${field}"`);
  }
  if (type && typeof data[field] !== type) {
    throw new HttpsError('invalid-argument', `"${field}" debe ser ${type}`);
  }
  return data[field];
}

/** Datos públicos de la partida que el cliente puede ver en tiempo real. */
function _publicMatchState(snap, playerIds) {
  return {
    phase:       snap.phase,
    current:     snap.current,
    direction:   snap.direction,
    drawStack:   snap.drawStack,
    chosenColor: snap.chosenColor,
    topDiscard:  snap.topDiscard,
    handCounts:  snap.handCounts,
    winner:      snap.winner,
    playerIds,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// joinMatch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Solicitud:
 *   { mode?: 'classic'|'cero', format?: '1v1', paid?: boolean }
 *
 * Respuesta:
 *   { matchId: string, playerIndex: number, charged: boolean, coinsLeft: number }
 */
exports.joinMatch = onCall(
  { region: CONFIG.REGION, timeoutSeconds: 30 },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid  = request.auth.uid;
    const data = request.data || {};
    const mode = ['classic', 'cero'].includes(data.mode) ? data.mode : 'classic';
    const paid = !!data.paid; // el cliente pide sala "paga" explícitamente

    const db = getFirestore();

    // ── 1. Verificar elegibilidad del usuario ────────────────────────────────
    const userRef = db.doc(`users/${uid}`);

    const result = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);

      // Crear perfil si es primera vez
      if (!userSnap.exists) {
        tx.set(userRef, {
          email:           request.auth.token.email || '',
          displayName:     request.auth.token.name  || 'Jugador',
          ceroCoins:       0,
          freeGamesPlayed: 0,
          totalGamesPlayed:0,
          createdAt:       FieldValue.serverTimestamp(),
        });
      }

      const user = userSnap.exists ? userSnap.data() : { ceroCoins: 0, freeGamesPlayed: 0 };
      const freeGames = user.freeGamesPlayed || 0;
      const coins     = user.ceroCoins || 0;

      let charged = false;
      let coinsLeft = coins;

      if (freeGames < CONFIG.FREE_GAMES_LIMIT) {
        // Partida gratuita — solo incrementar el contador al INICIAR (no aquí)
        // Aquí solo reservamos el cupo. El incremento real va en startMatch.
        charged = false;
      } else {
        // Ya usó las partidas gratis
        guard(
          coins >= CONFIG.ENTRY_COST_CC,
          'resource-exhausted',
          `Necesitás ${CONFIG.ENTRY_COST_CC} Cero Coins. Tenés ${coins}.`
        );
        // Descontar atomicamente
        tx.update(userRef, { ceroCoins: FieldValue.increment(-CONFIG.ENTRY_COST_CC) });
        coinsLeft = coins - CONFIG.ENTRY_COST_CC;
        charged   = true;
      }

      return { charged, coinsLeft, freeGames };
    });

    // ── 2. Buscar sala abierta o crear una nueva ─────────────────────────────
    const matchesRef = db.collection('matches');

    // Intentar unirse a una sala waiting del mismo modo
    const openQuery = await matchesRef
      .where('status',   '==', 'waiting')
      .where('mode',     '==', mode)
      .where('playerCount', '<', CONFIG.MAX_PLAYERS)
      .orderBy('playerCount')
      .orderBy('createdAt')
      .limit(5)
      .get();

    let matchId = null;
    let playerIndex = -1;

    for (const docSnap of openQuery.docs) {
      const d = docSnap.data();
      // No unirse a salas propias
      if ((d.playerIds || []).includes(uid)) continue;
      matchId    = docSnap.id;
      playerIndex = d.playerIds.length;
      break;
    }

    if (matchId) {
      // Unirse a sala existente
      const matchRef = db.doc(`matches/${matchId}`);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(matchRef);
        const d    = snap.data();
        guard(d.status === 'waiting', 'failed-precondition', 'La sala ya no está disponible');
        guard(d.playerIds.length < CONFIG.MAX_PLAYERS, 'failed-precondition', 'La sala está llena');

        const players     = [...d.players, { uid, name: request.auth.token.name || 'Jugador', index: d.playerIds.length }];
        const playerIds   = [...d.playerIds, uid];
        const playerCount = playerIds.length;

        tx.update(matchRef, { players, playerIds, playerCount });
      });
    } else {
      // Crear sala nueva
      const newMatch = {
        status:      'waiting',
        mode,
        players:     [{ uid, name: request.auth.token.name || 'Jugador', index: 0 }],
        playerIds:   [uid],
        playerCount: 1,
        maxPlayers:  CONFIG.MAX_PLAYERS,
        stakeCC:     result.charged ? CONFIG.ENTRY_COST_CC : 0,
        turn:        0,            // número de turno (idempotency key)
        createdAt:   FieldValue.serverTimestamp(),
        startedAt:   null,
        finishedAt:  null,
        winner:      null,
        // Estado público del juego (null hasta que empiece)
        phase:       PHASE.WAITING,
        current:     null,
        direction:   null,
        drawStack:   null,
        chosenColor: null,
        topDiscard:  null,
        handCounts:  null,
      };
      const ref = await matchesRef.add(newMatch);
      matchId    = ref.id;
      playerIndex = 0;
    }

    // ── 3. Si la sala tiene todos los jugadores, iniciar partida ─────────────
    const matchRef = db.doc(`matches/${matchId}`);
    const matchSnap = await matchRef.get();
    const matchData = matchSnap.data();

    if (matchData.playerIds.length >= CONFIG.MAX_PLAYERS && matchData.status === 'waiting') {
      await _startMatch(db, matchRef, matchData);
    }

    return {
      matchId,
      playerIndex,
      charged:   result.charged,
      coinsLeft: result.coinsLeft,
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// _startMatch  (helper interno, no es un endpoint)
// ─────────────────────────────────────────────────────────────────────────────

async function _startMatch(db, matchRef, matchData) {
  const playerIds = matchData.playerIds;
  const names     = matchData.players.map(p => p.name);

  // Construir y repartir con el engine
  const engine = new CeroEngine({
    playerCount: playerIds.length,
    names,
    handSize: CONFIG.HAND_SIZE,
  });
  const snap = engine.deal();

  // Incrementar freeGamesPlayed a cada usuario que no pagó
  const batch = db.batch();
  for (const uid of playerIds) {
    const userRef = db.doc(`users/${uid}`);
    batch.update(userRef, {
      freeGamesPlayed:  FieldValue.increment(1),
      totalGamesPlayed: FieldValue.increment(1),
    });
  }

  // Estado privado del servidor (deck + discard completo + todas las manos)
  const privateRef = db.doc(`matches/${matchRef.id}/private/server`);
  batch.set(privateRef, {
    deck:        snap.deck,
    discardPile: snap.discardPile,
    hands:       snap.hands,       // array por índice
    ceroCalled:  snap.ceroCalled,
    updatedAt:   FieldValue.serverTimestamp(),
  });

  // Mano de cada jugador en su subcollección privada
  for (let i = 0; i < playerIds.length; i++) {
    const handRef = db.doc(`matches/${matchRef.id}/hands/${playerIds[i]}`);
    batch.set(handRef, { cards: snap.hands[i], updatedAt: FieldValue.serverTimestamp() });
  }

  // Estado público de la partida
  batch.update(matchRef, {
    status:    'playing',
    startedAt: FieldValue.serverTimestamp(),
    turn:      1,
    ..._publicMatchState(snap, playerIds),
  });

  await batch.commit();
}

// ─────────────────────────────────────────────────────────────────────────────
// playTurn
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Solicitud:
 *   {
 *     matchId: string,
 *     turnNumber: number,   // debe coincidir con matches.turn (idempotencia)
 *     action: 'play' | 'draw' | 'pickColor' | 'declareCero',
 *     cardId?: number,      // requerido para action='play'
 *     color?:  string,      // requerido para action='pickColor'
 *   }
 *
 * Respuesta:
 *   { ok: true, publicState: object, myHand: Card[] }
 */
exports.playTurn = onCall(
  { region: CONFIG.REGION, timeoutSeconds: 30 },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid     = request.auth.uid;
    const data    = request.data || {};
    const matchId = requireField(data, 'matchId', 'string');
    const action  = requireField(data, 'action',  'string');

    guard(
      ['play', 'draw', 'pickColor', 'declareCero'].includes(action),
      'invalid-argument',
      `Acción inválida: ${action}`
    );

    const turnNumber = typeof data.turnNumber === 'number' ? data.turnNumber : -1;

    const db         = getFirestore();
    const matchRef   = db.doc(`matches/${matchId}`);
    const privateRef = db.doc(`matches/${matchId}/private/server`);
    const handRef    = db.doc(`matches/${matchId}/hands/${uid}`);

    let resultPublic = null;
    let resultHand   = null;

    await db.runTransaction(async (tx) => {
      const [matchSnap, privateSnap, handSnap] = await Promise.all([
        tx.get(matchRef),
        tx.get(privateRef),
        tx.get(handRef),
      ]);

      // ── Validaciones de acceso ─────────────────────────────────────────────
      guard(matchSnap.exists,   'not-found',          'Partida no encontrada');
      guard(privateSnap.exists, 'failed-precondition','Estado de servidor no disponible');

      const match   = matchSnap.data();
      const priv    = privateSnap.data();

      guard(match.status === 'playing',                'failed-precondition', 'La partida no está en curso');
      guard((match.playerIds || []).includes(uid),     'permission-denied',   'No sos parte de esta partida');
      guard(match.turn === turnNumber,                  'failed-precondition',
        `Turno desactualizado (servidor: ${match.turn}, cliente: ${turnNumber}). Recargá el estado.`);

      // ── Reconstruir el engine desde el snapshot privado ───────────────────
      const engineSnap = {
        phase:       match.phase,
        current:     match.current,
        direction:   match.direction,
        drawStack:   match.drawStack,
        chosenColor: match.chosenColor,
        pendingTurn: match.pendingTurn ?? null,
        winner:      match.winner,
        topDiscard:  match.topDiscard,
        discardPile: priv.discardPile,
        deck:        priv.deck,
        hands:       priv.hands,
        handCounts:  priv.hands.map(h => h.length),
        players:     match.players,
        ceroCalled:  priv.ceroCalled || [],
      };

      const engine      = CeroEngine.fromSnapshot(engineSnap);
      const playerIndex = match.playerIds.indexOf(uid);

      // ── Verificar que sea el turno del jugador ─────────────────────────────
      if (action !== 'declareCero') {
        guard(
          engine.current === playerIndex,
          'failed-precondition',
          'No es tu turno'
        );
      }

      // ── Ejecutar la acción ────────────────────────────────────────────────
      let actionResult;

      switch (action) {
        case 'play': {
          const cardId = data.cardId;
          guard(typeof cardId === 'number', 'invalid-argument', 'Falta cardId');
          actionResult = engine.play(playerIndex, cardId);
          break;
        }
        case 'draw': {
          actionResult = engine.draw(playerIndex);
          break;
        }
        case 'pickColor': {
          const color = data.color;
          guard(typeof color === 'string', 'invalid-argument', 'Falta color');
          actionResult = engine.pickColor(playerIndex, color);
          break;
        }
        case 'declareCero': {
          actionResult = engine.declareCero(playerIndex);
          break;
        }
      }

      // ── Rollback si el engine rechaza la acción ───────────────────────────
      if (!actionResult.ok) {
        throw new HttpsError('failed-precondition', actionResult.error);
      }

      // ── Guardar nuevo estado (transacción atómica) ─────────────────────────
      const newSnap = actionResult.snapshot || engine.snapshot();

      // Estado privado (deck, discard, manos)
      tx.set(privateRef, {
        deck:        newSnap.deck,
        discardPile: newSnap.discardPile,
        hands:       newSnap.hands,
        ceroCalled:  newSnap.ceroCalled,
        updatedAt:   FieldValue.serverTimestamp(),
      });

      // Mano actualizada de cada jugador en su subcollección
      for (let i = 0; i < match.playerIds.length; i++) {
        const pHandRef = db.doc(`matches/${matchId}/hands/${match.playerIds[i]}`);
        tx.set(pHandRef, { cards: newSnap.hands[i], updatedAt: FieldValue.serverTimestamp() });
      }

      // Estado público (el cliente escucha con onSnapshot)
      const newPublic = {
        ..._publicMatchState(newSnap, match.playerIds),
        turn:       match.turn + 1,
        status:     newSnap.phase === PHASE.GAME_OVER ? 'finished' : 'playing',
        winner:     newSnap.winner !== null ? match.playerIds[newSnap.winner] : null,
        finishedAt: newSnap.phase === PHASE.GAME_OVER ? FieldValue.serverTimestamp() : null,
        pendingTurn: newSnap.pendingTurn ?? null,
        lastAction:  {
          type:       action,
          uid,
          playerIdx:  playerIndex,
          card:       action === 'play'      ? { id: data.cardId } : null,
          color:      action === 'pickColor' ? data.color          : null,
          at:         FieldValue.serverTimestamp(),
        },
      };
      tx.update(matchRef, newPublic);

      // Si terminó la partida, actualizar estadísticas y premios
      if (newSnap.phase === PHASE.GAME_OVER) {
        const winnerUid = newPublic.winner;
        for (const pUid of match.playerIds) {
          const uRef = db.doc(`users/${pUid}`);
          if (pUid === winnerUid) {
            const prize = match.stakeCC * match.playerIds.length;
            tx.update(uRef, {
              wins:      FieldValue.increment(1),
              ceroCoins: prize > 0 ? FieldValue.increment(prize) : FieldValue.increment(0),
            });
          }
        }
      }

      resultPublic = newPublic;
      resultHand   = newSnap.hands[playerIndex];
    });

    return {
      ok:          true,
      publicState: resultPublic,
      myHand:      resultHand,
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// forfeitMatch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Solicitud: { matchId: string }
 * Respuesta: { ok: true, winnerUid: string }
 */
exports.forfeitMatch = onCall(
  { region: CONFIG.REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid     = request.auth.uid;
    const matchId = requireField(request.data || {}, 'matchId', 'string');

    const db       = getFirestore();
    const matchRef = db.doc(`matches/${matchId}`);
    const matchSnap = await matchRef.get();

    guard(matchSnap.exists,                          'not-found',       'Partida no encontrada');

    const match = matchSnap.data();

    guard(match.status === 'playing',                'failed-precondition', 'La partida no está en curso');
    guard((match.playerIds || []).includes(uid),     'permission-denied',   'No sos parte de esta partida');

    const winnerUid = match.playerIds.find(id => id !== uid);
    const winnerIdx = match.playerIds.indexOf(winnerUid);

    const batch = db.batch();

    batch.update(matchRef, {
      status:     'finished',
      winner:     winnerUid,
      phase:      PHASE.GAME_OVER,
      finishedAt: FieldValue.serverTimestamp(),
      forfeit:    { uid, winnerUid, at: FieldValue.serverTimestamp() },
    });

    // Devolver stake al ganador
    if (match.stakeCC > 0) {
      const prize = match.stakeCC * match.playerIds.length;
      batch.update(db.doc(`users/${winnerUid}`), {
        ceroCoins: FieldValue.increment(prize),
        wins:      FieldValue.increment(1),
      });
    } else {
      batch.update(db.doc(`users/${winnerUid}`), { wins: FieldValue.increment(1) });
    }

    await batch.commit();

    return { ok: true, winnerUid };
  }
);
