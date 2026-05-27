import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { tierColor, tierFromRating, winRate } from "../types/player";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, stats, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          CERO<span>GAME</span>
        </Link>
        <nav className="topnav">
          <Link to="/ranking">Ranking</Link>
        </nav>
        {user && (
          <div className="user-chip">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="avatar" />
            ) : (
              <div className="avatar fallback">{user.displayName?.[0] ?? "?"}</div>
            )}
            <div className="user-meta">
              <strong>{user.displayName}</strong>
              {stats && (
                <span style={{ color: tierColor(tierFromRating(stats.rating)) }}>
                  {tierFromRating(stats.rating)} · {stats.rating} ELO · {winRate(stats)}% WR
                </span>
              )}
            </div>
            <button type="button" className="btn ghost small" onClick={() => logout()}>
              Salir
            </button>
          </div>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
}
