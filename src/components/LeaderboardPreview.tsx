import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLeaderboard } from "../lib/stats";
import type { PlayerStats } from "../types/player";
import { tierColor, tierFromRating, winRate } from "../types/player";

export default function LeaderboardPreview() {
  const [rows, setRows] = useState<PlayerStats[]>([]);

  useEffect(() => {
    getLeaderboard(5)
      .then(setRows)
      .catch((error) => console.error("[LeaderboardPreview]", error));
  }, []);

  if (!rows.length) return null;

  return (
    <div className="card stack leaderboard-preview">
      <div className="section-head">
        <h3>Top jugadores</h3>
        <Link to="/ranking" className="link-accent">
          Ver ranking →
        </Link>
      </div>
      <div className="leaderboard-list">
        {rows.map((row, index) => (
          <div key={row.uid} className="leaderboard-row">
            <span className="rank">#{index + 1}</span>
            {row.photoURL ? (
              <img src={row.photoURL} alt="" className="avatar small" />
            ) : (
              <div className="avatar small fallback">{row.displayName[0]}</div>
            )}
            <div className="leaderboard-meta">
              <strong>{row.displayName}</strong>
              <span style={{ color: tierColor(tierFromRating(row.rating)) }}>
                {tierFromRating(row.rating)} · {row.rating} ELO
              </span>
            </div>
            <span className="wr">{winRate(row)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
