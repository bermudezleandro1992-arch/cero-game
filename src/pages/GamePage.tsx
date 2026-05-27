import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Square from "../components/Square";
import RoomStatusPanel from "../components/RoomStatusPanel";
import { useAuth } from "../context/AuthContext";
import { useLeaveOnTabClose } from "../hooks/useLeaveOnTabClose";
import { checkWinner, nextTurn } from "../lib/game";
import { joinRoom, leaveRoom, makeMove, resetRoom, subscribeToRoom } from "../lib/rooms";
import {
  countConnectedPlayers,
  getMyPlayer,
  type PlayerSymbol,
  type RoomData,
} from "../types/room";

export default function GamePage() {
  const { code = "" } = useParams();
  const { user, displayName, loading } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [ready, setReady] = useState(false);

  useLeaveOnTabClose(code, user?.uid, leaveRoom);

  useEffect(() => {
    if (loading || !user || !code) return;

    let unsubRoom: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const result = await joinRoom(code, user.uid, displayName);
      if (cancelled) return;

      if (!result.ok) {
        setConnectionError(result.error);
        setReady(true);
        return;
      }

      setRoom(result.room);
      setReady(true);

      unsubRoom = subscribeToRoom(
        code,
        (nextRoom) => {
          setRoom(nextRoom);
          if (!nextRoom) setConnectionError("La sala ya no existe.");
        },
        (message) => setConnectionError(message)
      );
    })();

    return () => {
      cancelled = true;
      unsubRoom?.();
    };
  }, [code, user, displayName, loading]);

  const me = room && user ? getMyPlayer(room, user.uid) : undefined;

  const handleMove = async (index: number) => {
    if (!room || !user || !me) return;
    if (room.board[index] || room.winner || room.turn !== me.symbol) return;

    const nextBoard = [...room.board];
    nextBoard[index] = me.symbol;
    const winner = checkWinner(nextBoard);
    const turn = winner ? room.turn : nextTurn(room.turn);

    await makeMove(code, user.uid, index, nextBoard, turn, winner);
  };

  if (loading || !ready) {
    return (
      <div className="page center">
        <div className="loader" />
      </div>
    );
  }

  if (connectionError && !room) {
    return (
      <div className="page">
        <div className="card stack">
          <h2>Error de conexión</h2>
          <p className="error">{connectionError}</p>
          <Link className="btn secondary" to="/">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  if (!room || !me || !user) return null;

  const connected = countConnectedPlayers(room.players);
  const waitingForOpponent = connected < room.maxPlayers;
  const myTurn = room.turn === me.symbol && !room.winner && !waitingForOpponent;

  let statusText = "";
  if (waitingForOpponent) {
    statusText = "Esperando que se reconecte el oponente...";
  } else if (room.winner === "draw") {
    statusText = "Empate";
  } else if (room.winner) {
    statusText = room.winner === me.symbol ? "¡Ganaste!" : "Perdiste";
  } else if (myTurn) {
    statusText = "Tu turno";
  } else {
    statusText = "Turno del oponente";
  }

  return (
    <div className="page">
      <div className="card stack game-card">
        <RoomStatusPanel room={room} />
        <p className="status-text">{statusText}</p>

        <div className="board">
          {room.board.map((cell, index) => (
            <Square
              key={index}
              value={cell as PlayerSymbol | null}
              onClick={() => handleMove(index)}
              disabled={!myTurn || waitingForOpponent}
              highlight={Boolean(cell && cell === me.symbol)}
            />
          ))}
        </div>

        {connectionError && <p className="error">{connectionError}</p>}

        <div className="actions-row">
          {room.winner && room.hostId === user.uid && (
            <button className="btn secondary" onClick={() => resetRoom(code, user.uid)}>
              Revancha
            </button>
          )}
          <button
            className="btn ghost"
            onClick={async () => {
              await leaveRoom(code, user.uid);
              navigate("/");
            }}
          >
            Salir
          </button>
          <Link className="btn ghost" to={`/sala/${code}`}>
            Volver al lobby
          </Link>
        </div>
      </div>
    </div>
  );
}
