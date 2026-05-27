import { useAuth } from "../context/AuthContext";
import { tierColor, tierFromRating } from "../types/player";

export default function GoogleLoginCard() {
  const { loginWithGoogle } = useAuth();

  return (
    <div className="card stack login-card">
      <div className="login-badge">Ranked Online</div>
      <h2>Entrá con Google</h2>
      <p className="hint">
        Guardá tu progreso, subí en el ranking ELO y competí contra otros jugadores en tiempo real.
      </p>
      <ul className="feature-list">
        <li>🏆 Ranking global con ligas Bronce → Leyenda</li>
        <li>📈 ELO dinámico por victorias y derrotas</li>
        <li>🔥 Rachas de victorias con récord personal</li>
        <li>⚔️ Salas 1v1 en tiempo real</li>
      </ul>
      <button type="button" className="btn google" onClick={() => loginWithGoogle()}>
        <span className="google-icon">G</span>
        Continuar con Google
      </button>
    </div>
  );
}

export function PlayerStatsCard() {
  const { stats } = useAuth();
  if (!stats) return null;

  const tier = tierFromRating(stats.rating);

  return (
    <div className="stats-card">
      <div className="stats-grid">
        <div>
          <span className="stat-label">Rating</span>
          <strong>{stats.rating}</strong>
        </div>
        <div>
          <span className="stat-label">Victorias</span>
          <strong>{stats.wins}</strong>
        </div>
        <div>
          <span className="stat-label">Racha</span>
          <strong>{stats.streak} 🔥</strong>
        </div>
        <div>
          <span className="stat-label">Mejor racha</span>
          <strong>{stats.bestStreak}</strong>
        </div>
      </div>
      <p className="tier-pill" style={{ borderColor: tierColor(tier), color: tierColor(tier) }}>
        Liga {tier}
      </p>
    </div>
  );
}
