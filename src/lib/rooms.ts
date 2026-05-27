import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { customAlphabet } from "nanoid";
import { db } from "./firebase";
import {
  countConnectedPlayers,
  countPlayers,
  parseRoomData,
  roomToFirestore,
  type JoinRoomResult,
  type PlayerSymbol,
  type RoomData,
  type RoomPlayer,
} from "../types/room";

const ROOMS = "rooms";
const generateCode = customAlphabet("0123456789", 6);

function emptyBoard(): (PlayerSymbol | null)[] {
  return Array(9).fill(null);
}

function nextSymbol(players: Record<string, RoomPlayer>): PlayerSymbol {
  const symbols = Object.values(players).map((p) => p.symbol);
  return symbols.includes("X") ? "O" : "X";
}

async function codeExists(code: string): Promise<boolean> {
  const snap = await getDoc(doc(db, ROOMS, code));
  return snap.exists();
}

async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = generateCode();
    if (!(await codeExists(code))) return code;
  }
  throw new Error("No se pudo generar un código de sala único.");
}

export async function createRoom(uid: string, displayName: string): Promise<RoomData> {
  const code = await generateUniqueCode();
  const now = Date.now();

  const player: RoomPlayer = {
    uid,
    displayName,
    symbol: "X",
    connected: true,
    joinedAt: now,
  };

  const room: RoomData = {
    code,
    status: "waiting",
    hostId: uid,
    maxPlayers: 2,
    board: emptyBoard(),
    turn: "X",
    winner: null,
    createdAt: now,
    updatedAt: now,
    players: { [uid]: player },
  };

  await setDoc(doc(db, ROOMS, code), {
    ...roomToFirestore(room),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return room;
}

export async function joinRoom(
  code: string,
  uid: string,
  displayName: string
): Promise<JoinRoomResult> {
  const roomRef = doc(db, ROOMS, code);

  try {
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) {
        return { ok: false as const, error: "La sala no existe." };
      }

      const room = parseRoomData(code, snap.data() as Record<string, unknown>);
      const existing = room.players[uid];

      if (existing) {
        room.players[uid] = {
          ...existing,
          connected: true,
          displayName: displayName || existing.displayName,
        };
        room.updatedAt = Date.now();
        tx.update(roomRef, {
          [`players.${uid}`]: room.players[uid],
          updatedAt: serverTimestamp(),
        });
        return { ok: true as const, room };
      }

      if (room.status === "finished") {
        return { ok: false as const, error: "Esta sala ya finalizó." };
      }

      const connectedCount = countConnectedPlayers(room.players);
      const totalCount = countPlayers(room.players);

      if (connectedCount >= room.maxPlayers) {
        return { ok: false as const, error: "La sala está llena." };
      }

      if (totalCount >= room.maxPlayers) {
        return { ok: false as const, error: "La sala está llena. Esperá a que alguien se desconecte." };
      }

      const symbol = nextSymbol(room.players);
      const player: RoomPlayer = {
        uid,
        displayName,
        symbol,
        connected: true,
        joinedAt: Date.now(),
      };

      room.players[uid] = player;
      room.updatedAt = Date.now();

      const updates: Record<string, unknown> = {
        [`players.${uid}`]: player,
        updatedAt: serverTimestamp(),
      };

      if (countConnectedPlayers(room.players) >= room.maxPlayers) {
        room.status = "playing";
        updates.status = "playing";
      }

      tx.update(roomRef, updates);
      return { ok: true as const, room };
    });

    return result;
  } catch (error) {
    console.error("[joinRoom]", error);
    return { ok: false, error: "Error de conexión al unirse a la sala." };
  }
}

export async function leaveRoom(code: string, uid: string): Promise<void> {
  const roomRef = doc(db, ROOMS, code);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) return;

      const room = parseRoomData(code, snap.data() as Record<string, unknown>);
      const player = room.players[uid];
      if (!player) return;

      room.players[uid] = { ...player, connected: false };

      const connected = countConnectedPlayers(room.players);
      const updates: Record<string, unknown> = {
        [`players.${uid}.connected`]: false,
        updatedAt: serverTimestamp(),
      };

      if (connected === 0) {
        updates.status = "waiting";
      } else if (room.status === "playing" && connected < room.maxPlayers) {
        updates.status = "waiting";
      }

      tx.update(roomRef, updates);
    });
  } catch (error) {
    console.error("[leaveRoom]", error);
  }
}

export async function getRoom(code: string): Promise<RoomData | null> {
  const snap = await getDoc(doc(db, ROOMS, code));
  if (!snap.exists()) return null;
  return parseRoomData(code, snap.data() as Record<string, unknown>);
}

export function subscribeToRoom(
  code: string,
  onData: (room: RoomData | null) => void,
  onError: (message: string) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, ROOMS, code),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(parseRoomData(code, snap.data() as Record<string, unknown>));
    },
    (error) => {
      console.error("[subscribeToRoom]", error);
      onError("Error de conexión con la sala. Verificá tu internet o Firebase.");
    }
  );
}

export async function makeMove(
  code: string,
  uid: string,
  index: number,
  nextBoard: (PlayerSymbol | null)[],
  nextTurn: PlayerSymbol,
  winner: PlayerSymbol | "draw" | null
): Promise<boolean> {
  const roomRef = doc(db, ROOMS, code);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Sala no encontrada");

      const room = parseRoomData(code, snap.data() as Record<string, unknown>);
      const player = room.players[uid];
      if (!player || !player.connected) throw new Error("Jugador no conectado");
      if (room.status !== "playing") throw new Error("La partida no está activa");
      if (room.board[index] !== null) throw new Error("Casilla ocupada");
      if (player.symbol !== room.turn) throw new Error("No es tu turno");

      tx.update(roomRef, {
        board: nextBoard,
        turn: nextTurn,
        winner,
        status: winner ? "finished" : "playing",
        updatedAt: serverTimestamp(),
      });
    });
    return true;
  } catch (error) {
    console.error("[makeMove]", error);
    return false;
  }
}

export async function resetRoom(code: string, uid: string): Promise<boolean> {
  const roomRef = doc(db, ROOMS, code);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Sala no encontrada");

      const room = parseRoomData(code, snap.data() as Record<string, unknown>);
      if (room.hostId !== uid) throw new Error("Solo el anfitrión puede reiniciar");

      tx.update(roomRef, {
        board: emptyBoard(),
        turn: "X",
        winner: null,
        status: countConnectedPlayers(room.players) >= room.maxPlayers ? "playing" : "waiting",
        updatedAt: serverTimestamp(),
      });
    });
    return true;
  } catch (error) {
    console.error("[resetRoom]", error);
    return false;
  }
}

export async function setPlayerConnected(code: string, uid: string, connected: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, ROOMS, code), {
      [`players.${uid}.connected`]: connected,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Room may have been removed; ignore.
  }
}
