import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import RoomStatusPanel from "../components/RoomStatusPanel";
import { useAuth } from "../context/AuthContext";
import { useLeaveOnTabClose } from "../hooks/useLeaveOnTabClose";
import { joinRoom, leaveRoom, subscribeToRoom } from "../lib/rooms";
import { countConnectedPlayers, type RoomData } from "../types/room";

export default function RoomPage() {
  const { code = "" } = useParams();
  const { user, displayName, loading } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [joining, setJoining] = useState(true);

  useLeaveOnTabClose(code, user?.uid, leaveRoom);

  useEffect(() => {
    if (loading || !user || !code) return;

    let unsubRoom: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      setJoining(true);
      setConnectionError("");

      const result = await joinRoom(code, user.uid, displayName);
      if (cancelled) return;

      if (!result.ok) {
        setConnectionError(result.error);
        setJoining(false);
        return;
      }

      setRoom(result.room);
      setJoining(false);

      unsubRoom = subscribeToRoom(
        code,
        (nextRoom) => {
          setRoom(nextRoom);
          if (!nextRoom) {
            setConnectionError("La sala ya no existe.");
          }
        },
        (message) => setConnectionError(message)
      );
    })();

    return () => {
      cancelled = true;
      unsubRoom?.();
    };
  }, [code, user, displayName, loading]);

  useEffect(() => {
    if (!room || !user) return;
    const connected = countConnectedPlayers(room.players);
    if (room.status === "playing" && connected >= room.maxPlayers) {
      navigate(`/juego/${code}`, { replace: true });
    }
  }, [room, user, code, navigate]);

  if (loading || !user) {
    return (
      <div className="page center">
        <div className="loader" />
      </div>
    );
  }

  if (joining) {
    return (
      <div className="page center">
        <div className="loader" />
        <p>Conectando a la sala {code}...</p>
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

  if (!room) return null;

  const connected = countConnectedPlayers(room.players);
  const isFull = connected >= room.maxPlayers;

  return (
    <div className="page">
      <div className="card stack">
        <div className="room-code-box">
          <p>Código de sala</p>
          <h2>{room.code}</h2>
          <p className="hint">Compartí este código para que otro jugador se una.</p>
        </div>

        <RoomStatusPanel room={room} />

        {!isFull ? (
          <div className="waiting-box">
            <div className="loader small" />
            <p>Esperando oponente ({connected}/{room.maxPlayers})...</p>
          </div>
        ) : (
          <button className="btn primary" onClick={() => navigate(`/juego/${code}`)}>
            Entrar al juego
          </button>
        )}

        {connectionError && <p className="error">{connectionError}</p>}

        <button
          className="btn ghost"
          onClick={async () => {
            await leaveRoom(code, user.uid);
            navigate("/");
          }}
        >
          Salir de la sala
        </button>
      </div>
    </div>
  );
}
