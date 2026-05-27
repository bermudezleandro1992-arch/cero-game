export type PlayerSymbol = "X" | "O";
export type RoomStatus = "waiting" | "playing" | "finished";

export interface RoomPlayer {
  uid: string;
  displayName: string;
  symbol: PlayerSymbol;
  connected: boolean;
  joinedAt: number;
}

export interface RoomData {
  code: string;
  status: RoomStatus;
  hostId: string;
  maxPlayers: number;
  board: (PlayerSymbol | null)[];
  turn: PlayerSymbol;
  winner: PlayerSymbol | "draw" | null;
  createdAt: number;
  updatedAt: number;
  players: Record<string, RoomPlayer>;
}

export type JoinRoomResult =
  | { ok: true; room: RoomData }
  | { ok: false; error: string };

export function countConnectedPlayers(players: Record<string, RoomPlayer>): number {
  return Object.values(players).filter((p) => p.connected).length;
}

export function countPlayers(players: Record<string, RoomPlayer>): number {
  return Object.keys(players).length;
}

export function getPlayerList(players: Record<string, RoomPlayer>): RoomPlayer[] {
  return Object.values(players).sort((a, b) => a.joinedAt - b.joinedAt);
}

export function getMyPlayer(room: RoomData, uid: string): RoomPlayer | undefined {
  return room.players[uid];
}

export function roomToFirestore(room: RoomData) {
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    board: room.board,
    turn: room.turn,
    winner: room.winner,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    players: room.players,
  };
}

export function parseRoomData(code: string, data: Record<string, unknown>): RoomData {
  const playersRaw = (data.players as Record<string, RoomPlayer> | undefined) ?? {};
  return {
    code,
    status: (data.status as RoomStatus) ?? "waiting",
    hostId: String(data.hostId ?? ""),
    maxPlayers: Number(data.maxPlayers ?? 2),
    board: Array.isArray(data.board) ? (data.board as (PlayerSymbol | null)[]) : Array(9).fill(null),
    turn: (data.turn as PlayerSymbol) ?? "X",
    winner: (data.winner as PlayerSymbol | "draw" | null) ?? null,
    createdAt: Number(data.createdAt ?? Date.now()),
    updatedAt: Number(data.updatedAt ?? Date.now()),
    players: playersRaw,
  };
}
