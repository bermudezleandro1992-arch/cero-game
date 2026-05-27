/**

 * Matchmaking — cola en matchmaking/{game}/queue/{uid}

 * + fallback: escucha salas donde ya estás en playerIds (por si falla la cola).

 */

'use strict';



const MM = (() => {

  const TIMEOUT_MS = 90_000;

  const QUICK_KEYS = { truco: 'truco-quick-1v1', cero: 'cero-quick-1v1' };



  let _unsubs = [];

  let _timeout = null;

  let _queueRef = null;

  let _pairing = false;

  let _resolved = false;



  function _cleanup() {

    _unsubs.forEach(u => { try { u(); } catch (_) {} });

    _unsubs = [];

    clearTimeout(_timeout);

    _timeout = null;

    _pairing = false;

    if (_queueRef && window.FBHub) {

      window.FBHub.deleteDoc(_queueRef).catch(() => {});

      _queueRef = null;

    }

  }



  function buildOptsKey(game, opts) {

    if (opts?.quick) return QUICK_KEYS[game] || `${game}-quick`;

    if (game === 'truco') {

      const pts = String(opts.points || '15');

      const flor = opts.flor === true || opts.flor === 'si' ? 'si' : 'no';

      const mode = opts.mode || '1v1';

      const voice = opts.voice === 'female' ? 'female' : 'male';

      return `t-${pts}-${flor}-${mode}-${voice}`;

    }

    const mode = opts.mode || 'classic';

    const format = opts.format || '1v1';

    return `c-${mode}-${format}`;

  }



  async function _clearMyQueue(db, game, uid) {

    const { getDocs, deleteDoc, collection, query, where } = window.FBHub;

    try {

      const snap = await getDocs(query(

        collection(db, 'matchmaking', game, 'queue'),

        where('uid', '==', uid),

      ));

      await Promise.all(snap.docs.map(d => deleteDoc(d.ref).catch(() => {})));

    } catch (_) {}

  }



  async function join(game, user, opts = {}, onStatus = () => {}, onQueueCount = () => {}) {

    if (!window.FBHub?.db) throw new Error('Firebase no listo');

    _cleanup();

    _resolved = false;



    const {

      db, collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, where, limit,

      serverTimestamp, deleteDoc, runTransaction,

    } = window.FBHub;



    const uid = user.uid;

    if (!uid) throw new Error('Sin sesión');



    const displayName = user.name || user.displayName || 'Jugador';

    const optsKey = buildOptsKey(game, { ...opts, quick: true });

    const joinedAtMs = Date.now();



    await _clearMyQueue(db, game, uid);



    _queueRef = doc(db, 'matchmaking', game, 'queue', uid);

    await setDoc(_queueRef, {

      uid,

      gameKey: game,

      optsKey,

      name: displayName,

      photo: user.photo || null,

      joinedAtMs,

      joinedAt: serverTimestamp(),

      status: 'waiting',

      roomId: null,

    });



    onStatus('Buscando rival…');

    onQueueCount(1);



    const queueCol = collection(db, 'matchmaking', game, 'queue');

    const cq = query(queueCol, where('status', '==', 'waiting'), limit(32));



    const roomFallbackQ = query(

      collection(db, 'rooms'),

      where('playerIds', 'array-contains', uid),

      where('status', '==', 'waiting'),

      limit(8),
    );



    return new Promise((resolve, reject) => {

      const finish = (roomId, source = 'queue') => {

        if (_resolved || !roomId) return;

        _resolved = true;

        clearTimeout(_timeout);

        onStatus(source === 'room' ? 'Sala lista. Entrando…' : '¡Emparejados! Entrando…');

        setTimeout(() => deleteDoc(_queueRef).catch(() => {}), 4000);

        _unsubs.forEach(u => { try { u(); } catch (_) {} });

        _unsubs = [];

        _queueRef = null;

        _pairing = false;

        resolve({ roomId });

      };



      _timeout = setTimeout(() => {

        if (_resolved) return;

        _cleanup();

        reject(new Error('timeout'));

      }, TIMEOUT_MS);



      const tryCreateRoom = async (partner) => {

        if (_pairing || _resolved) return;

        _pairing = true;

        onStatus(`Emparejando con ${partner.name}…`);



        const partnerQRef = doc(db, 'matchmaking', game, 'queue', partner.uid);

        const pairKey = [uid, partner.uid].sort().join('|');



        try {

          const existingSnap = await getDocs(query(

            collection(db, 'rooms'),

            where('pairKey', '==', pairKey),

            where('status', '==', 'waiting'),

            limit(1),

          ));

          if (!existingSnap.empty) {

            const existingId = existingSnap.docs[0].id;

            await Promise.all([

              setDoc(_queueRef, { status: 'matched', roomId: existingId }, { merge: true }),

              setDoc(partnerQRef, { status: 'matched', roomId: existingId }, { merge: true }),

            ]);

            finish(existingId, 'existing-pair');

            return;

          }



          const newRoomRef = doc(collection(db, 'rooms'));

          const roomId = newRoomRef.id;

          const players = [

            { uid, name: displayName, photo: user.photo || null },

            { uid: partner.uid, name: partner.name, photo: partner.photo || null },

          ];



          const base = {

            game,

            optsKey,

            pairKey,

            mode: game === 'truco' ? '1v1' : 'classic',

            format: opts.format || '1v1',

            status: 'waiting',

            players,

            playerIds: players.map(p => p.uid),

            hostId: uid,

            hostName: displayName,

            maxPlayers: 2,

            stakeCC: 0,

            stakesPaid: [],

            allowSpectate: true,

            isPrivate: false,

            createdAt: serverTimestamp(),

            lastActivity: serverTimestamp(),

            phase: null,

            trucoPvP: { seq: 0 },

            [`ready_${uid}`]: true,

            [`ready_${partner.uid}`]: true,

          };

          if (game === 'truco') {

            base.trucoOpts = {

              points: opts.points || 15,

              flor: opts.flor === true || opts.flor === 'si',

              mode: '1v1',

              voice: opts.voice || 'male',

            };

          } else {

            base.voice = opts.voice || 'fem';

          }



          let matchedRoomId = roomId;

          await runTransaction(db, async tx => {

            const [partnerSnap, mySnap] = await Promise.all([

              tx.get(partnerQRef),

              tx.get(_queueRef),

            ]);

            const partnerData = partnerSnap.data();

            const myData = mySnap.data();

            if (partnerData?.roomId) {

              matchedRoomId = partnerData.roomId;

              return;

            }

            if (myData?.roomId) {

              matchedRoomId = myData.roomId;

              return;

            }

            tx.set(newRoomRef, base);

            tx.set(_queueRef, { status: 'matched', roomId }, { merge: true });

            tx.set(partnerQRef, { status: 'matched', roomId }, { merge: true });

          });



          finish(matchedRoomId, matchedRoomId === roomId ? 'created' : 'matched-race');

        } catch (e) {

          console.error('[MM] create room:', e);

          _pairing = false;

          onStatus('Error al crear sala. Reintentá…');

        }

      };



      const unsubQueue = onSnapshot(cq, snap => {

        if (_resolved) return;

        const waiting = snap.docs

          .map(d => ({ ...d.data(), _id: d.id }))

          .filter(p => p.uid && p.status === 'waiting' && p.optsKey === optsKey);

        onQueueCount(waiting.length);



        const others = waiting.filter(p => p.uid !== uid);

        if (!others.length) {

          onStatus(`Esperando rival… (${waiting.length} en cola)`);

          return;

        }



        const partner = others.sort((a, b) => (a.joinedAtMs || 0) - (b.joinedAtMs || 0))[0];

        onStatus(`¡Rival: ${partner.name}!`);



        const leader = uid < partner.uid ? uid : partner.uid;

        if (uid === leader) tryCreateRoom(partner);

        else onStatus('Rival encontrado. Armando mesa…');

      }, err => {

        console.error('[MM] queue listen:', err);

        onStatus('Cola no disponible. Creá sala privada e invitá.');

        if (!_resolved) reject(err);

      });

      _unsubs.push(unsubQueue);



      const unsubSelf = onSnapshot(_queueRef, snap => {

        const data = snap.data();

        if (data?.status === 'matched' && data.roomId) {

          finish(data.roomId, 'self-queue');

        }

      }, err => console.warn('[MM] self queue:', err));

      _unsubs.push(unsubSelf);



      const unsubRoom = onSnapshot(roomFallbackQ, snap => {

        if (_resolved) return;

        for (const d of snap.docs) {

          const data = d.data();

          if (data.game !== game) continue;

          const ids = [...new Set(data.playerIds || [])];

          if (ids.length >= 2 && ids.includes(uid)) {

            finish(d.id, 'room');

            return;

          }

        }

      }, err => console.warn('[MM] room fallback:', err));

      _unsubs.push(unsubRoom);

    });

  }



  function cancel() {

    _resolved = true;

    _cleanup();

  }



  return { join, cancel, buildOptsKey };

})();



window.MM = MM;


