import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import GoogleLoginCard, { PlayerStatsCard } from "../components/GoogleLoginCard";
import LeaderboardPreview from "../components/LeaderboardPreview";
import { useAuth } from "../context/AuthContext";
import { createRoom, joinRoom } from "../lib/rooms";

export default function HomePage() {
  const { user, displayName, loading } = useAuth();
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (loading) {
    return (
      <div className="page center">
        <div className="loader" />
        <p>Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <div className="hero">
          <p className="eyebrow">Tateti ranked online</p>
          <h1>CERO GAME</h1>
          <p className="subtitle">Multijugador en tiempo real con ranking ELO y login Google.</p>
        </div>
        <GoogleLoginCard />
        <LeaderboardPreview />
      </div>
    );
  }

  const handlePlayNow = async () => {
    setError("");
    setBusy(true);
    try {
      const room = await createRoom(user.uid, displayName);
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
      const result = await joinRoom(code, user.uid, displayName);
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
    <AppShell>
      <div className="page home-page">
        <div className="hero compact">
          <p className="eyebrow">Listo para ranked</p>
          <h1>¿Jugamos?</h1>
          <p className="subtitle">Creá una sala o unite con código. Cada victoria suma ELO.</p>
        </div>

        <PlayerStatsCard />

        <div className="card stack">
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

        <LeaderboardPreview />
      </div>
    </AppShell>
  );
}
