import type { PlayerSymbol } from "../types/room";

export const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export function checkWinner(board: (PlayerSymbol | null)[]): PlayerSymbol | "draw" | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as PlayerSymbol;
    }
  }
  if (board.every((cell) => cell !== null)) return "draw";
  return null;
}

export function nextTurn(current: PlayerSymbol): PlayerSymbol {
  return current === "X" ? "O" : "X";
}
