import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import { getLeaderboard } from "../lib/stats";
import type { PlayerStats } from "../types/player";
import { tierColor, tierFromRating, winRate } from "../types/player";
import { useAuth } from "../context/AuthContext";

export default function RankingPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard(50)
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const myRank = user ? rows.findIndex((r) => r.uid === user.uid) + 1 : 0;

  return (
    <AppShell>
      <div className="page ranking-page">
        <div className="hero compact">
          <p className="eyebrow">Competencia global</p>
          <h1>Ranking ELO</h1>
          <p className="subtitle">
            Subí de liga ganando partidas. Las derrotas restan rating, los empates suman poco.
          </p>
        </div>

        <div className="tier-legend card">
          {(["Bronce", "Plata", "Oro", "Diamante", "Leyenda"] as const).map((tier) => (
            <span key={tier} style={{ color: tierColor(tier) }}>
              {tier}
            </span>
          ))}
        </div>

        {user && myRank > 0 && (
          <div className="card my-rank-banner">
            Tu posición actual: <strong>#{myRank}</strong>
          </div>
        )}

        <div className="card stack">
          {loading ? (
            <div className="page center">
              <div className="loader" />
            </div>
          ) : rows.length === 0 ? (
            <p className="hint">Todavía no hay partidas ranked. ¡Sé el primero!</p>
          ) : (
            <div className="leaderboard-list full">
              {rows.map((row, index) => {
                const tier = tierFromRating(row.rating);
                const isMe = user?.uid === row.uid;
                return (
                  <div key={row.uid} className={`leaderboard-row ${isMe ? "me" : ""}`}>
                    <span className="rank">#{index + 1}</span>
                    {row.photoURL ? (
                      <img src={row.photoURL} alt="" className="avatar small" />
                    ) : (
                      <div className="avatar small fallback">{row.displayName[0]}</div>
                    )}
                    <div className="leaderboard-meta">
                      <strong>
                        {row.displayName}
                        {isMe ? " (vos)" : ""}
                      </strong>
                      <span style={{ color: tierColor(tier) }}>
                        {tier} · {row.rating} ELO · {row.wins}W / {row.losses}L / {row.draws}D
                      </span>
                    </div>
                    <div className="leaderboard-side">
                      <span className="wr">{winRate(row)}%</span>
                      {row.streak > 1 && <span className="streak">{row.streak}🔥</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Link to="/" className="btn secondary">
            Volver a jugar
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
