import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import { getDisplayName, getPhotoURL } from "./auth";
import type { PlayerStats } from "../types/player";
import type { PlayerSymbol } from "../types/room";

const PLAYERS = "players";

function defaultStats(uid: string, displayName: string, photoURL: string | null): PlayerStats {
  const now = Date.now();
  return {
    uid,
    displayName,
    photoURL,
    wins: 0,
    losses: 0,
    draws: 0,
    rating: 1000,
    streak: 0,
    bestStreak: 0,
    lastPlayedAt: now,
    createdAt: now,
  };
}

function parseStats(uid: string, data: Record<string, unknown>): PlayerStats {
  return {
    uid,
    displayName: String(data.displayName ?? "Jugador"),
    photoURL: (data.photoURL as string | null) ?? null,
    wins: Number(data.wins ?? 0),
    losses: Number(data.losses ?? 0),
    draws: Number(data.draws ?? 0),
    rating: Number(data.rating ?? 1000),
    streak: Number(data.streak ?? 0),
    bestStreak: Number(data.bestStreak ?? 0),
    lastPlayedAt: Number(data.lastPlayedAt ?? Date.now()),
    createdAt: Number(data.createdAt ?? Date.now()),
  };
}

export async function ensurePlayerProfile(user: User): Promise<PlayerStats> {
  const ref = doc(db, PLAYERS, user.uid);
  const snap = await getDoc(ref);
  const displayName = getDisplayName(user);
  const photoURL = getPhotoURL(user);

  if (snap.exists()) {
    const current = parseStats(user.uid, snap.data() as Record<string, unknown>);
    if (current.displayName !== displayName || current.photoURL !== photoURL) {
      await setDoc(
        ref,
        { displayName, photoURL, updatedAt: serverTimestamp() },
        { merge: true }
      );
      return { ...current, displayName, photoURL };
    }
    return current;
  }

  const stats = defaultStats(user.uid, displayName, photoURL);
  await setDoc(ref, {
    ...stats,
    updatedAt: serverTimestamp(),
  });
  return stats;
}

export async function getPlayerStats(uid: string): Promise<PlayerStats | null> {
  const snap = await getDoc(doc(db, PLAYERS, uid));
  if (!snap.exists()) return null;
  return parseStats(uid, snap.data() as Record<string, unknown>);
}

export async function getLeaderboard(limitCount = 20): Promise<PlayerStats[]> {
  const snap = await getDocs(
    query(collection(db, PLAYERS), orderBy("rating", "desc"), limit(limitCount))
  );
  return snap.docs.map((d) => parseStats(d.id, d.data() as Record<string, unknown>));
}

function expectedScore(myRating: number, oppRating: number): number {
  return 1 / (1 + 10 ** ((oppRating - myRating) / 400));
}

function applyResult(
  stats: PlayerStats,
  result: "win" | "loss" | "draw",
  opponentRating: number
): PlayerStats {
  const K = 32;
  let score = 0.5;
  if (result === "win") score = 1;
  if (result === "loss") score = 0;

  const delta = Math.round(K * (score - expectedScore(stats.rating, opponentRating)));
  const nextRating = Math.max(800, stats.rating + delta);

  if (result === "win") {
    const streak = stats.streak + 1;
    return {
      ...stats,
      wins: stats.wins + 1,
      rating: nextRating,
      streak,
      bestStreak: Math.max(stats.bestStreak, streak),
      lastPlayedAt: Date.now(),
    };
  }

  if (result === "loss") {
    return {
      ...stats,
      losses: stats.losses + 1,
      rating: nextRating,
      streak: 0,
      lastPlayedAt: Date.now(),
    };
  }

  return {
    ...stats,
    draws: stats.draws + 1,
    rating: nextRating,
    streak: 0,
    lastPlayedAt: Date.now(),
  };
}

export async function recordMatchStats(
  roomCode: string,
  winner: PlayerSymbol | "draw",
  playerUids: { uid: string; symbol: PlayerSymbol }[]
): Promise<void> {
  if (playerUids.length < 2) return;

  const roomRef = doc(db, "rooms", roomCode);

  await runTransaction(db, async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) return;
    const roomData = roomSnap.data();
    if (roomData.statsRecorded) return;

    const [a, b] = playerUids;
    const playerARef = doc(db, PLAYERS, a.uid);
    const playerBRef = doc(db, PLAYERS, b.uid);
    const [snapA, snapB] = await Promise.all([tx.get(playerARef), tx.get(playerBRef)]);

    const statsA = snapA.exists()
      ? parseStats(a.uid, snapA.data() as Record<string, unknown>)
      : defaultStats(a.uid, "Jugador", null);
    const statsB = snapB.exists()
      ? parseStats(b.uid, snapB.data() as Record<string, unknown>)
      : defaultStats(b.uid, "Jugador", null);

    let resultA: "win" | "loss" | "draw";
    if (winner === "draw") {
      resultA = "draw";
    } else if (winner === a.symbol) {
      resultA = "win";
    } else {
      resultA = "loss";
    }

    const resultB =
      resultA === "draw" ? "draw" : resultA === "win" ? "loss" : "win";

    const updatedA = applyResult(statsA, resultA, statsB.rating);
    const updatedB = applyResult(statsB, resultB, statsA.rating);

    tx.set(playerARef, { ...updatedA, updatedAt: serverTimestamp() }, { merge: true });
    tx.set(playerBRef, { ...updatedB, updatedAt: serverTimestamp() }, { merge: true });
    tx.update(roomRef, { statsRecorded: true, statsRecordedAt: serverTimestamp() });
  });
}
