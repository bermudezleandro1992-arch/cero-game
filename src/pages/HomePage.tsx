import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createRoom, joinRoom } from "../lib/rooms";

export default function HomePage() {
  const { user, displayName, loading, setDisplayName } = useAuth();
  const navigate = useNavigate();
  const [nameInput, setNameInput] = useState(displayName);
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (loading || !user) {
    return (
      <div className="page center">
        <div className="loader" />
        <p>Conectando...</p>
      </div>
    );
  }

  const handlePlayNow = async () => {
    setError("");
    setBusy(true);
    try {
      await setDisplayName(nameInput);
      const room = await createRoom(user.uid, nameInput.trim() || displayName);
      navigate(`/sala/${room.code}`);
    } catch (err) {
      console.error(err);
      setError("No se pudo crear la sala. Verificá la conexión a Firebase.");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    const code = roomCode.trim();
    if (!code) {
      setError("Ingresá el código de la sala.");
      return;
    }

    setError("");
    setBusy(true);
    try {
      await setDisplayName(nameInput);
      const result = await joinRoom(code, user.uid, nameInput.trim() || displayName);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      navigate(`/sala/${code}`);
    } catch (err) {
      console.error(err);
      setError("Error de conexión al unirse.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="hero">
        <p className="eyebrow">Multijugador en tiempo real</p>
        <h1>CERO GAME</h1>
        <p className="subtitle">Crea una sala, compartí el código y juega al instante.</p>
      </div>

      <div className="card stack">
        <label className="field">
          <span>Tu nombre</span>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Jugador"
            maxLength={20}
          />
        </label>

        <button className="btn primary" onClick={handlePlayNow} disabled={busy}>
          {busy ? "Creando sala..." : "Jugar ahora"}
        </button>

        <div className="divider">o unirse con código</div>

        <label className="field">
          <span>Código de sala</span>
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
          />
        </label>

        <button className="btn secondary" onClick={handleJoin} disabled={busy}>
          Unirse a sala
        </button>

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
