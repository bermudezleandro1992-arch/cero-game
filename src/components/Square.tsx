import type { PlayerSymbol } from "../types/room";

interface Props {
  value: PlayerSymbol | null;
  onClick?: () => void;
  disabled?: boolean;
  highlight?: boolean;
}

export default function Square({ value, onClick, disabled, highlight }: Props) {
  return (
    <button
      type="button"
      className={`square ${value ? `symbol-${value.toLowerCase()}` : ""} ${highlight ? "highlight" : ""}`}
      onClick={onClick}
      disabled={disabled || Boolean(value)}
      aria-label={value ? `Casilla ${value}` : "Casilla vacía"}
    >
      {value}
    </button>
  );
}
