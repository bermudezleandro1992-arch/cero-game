export type Tier = "Bronce" | "Plata" | "Oro" | "Diamante" | "Leyenda";

export interface PlayerStats {
  uid: string;
  displayName: string;
  photoURL: string | null;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
  streak: number;
  bestStreak: number;
  lastPlayedAt: number;
  createdAt: number;
}

export function tierFromRating(rating: number): Tier {
  if (rating >= 1600) return "Leyenda";
  if (rating >= 1400) return "Diamante";
  if (rating >= 1200) return "Oro";
  if (rating >= 1000) return "Plata";
  return "Bronce";
}

export function tierColor(tier: Tier): string {
  switch (tier) {
    case "Leyenda":
      return "#f472b6";
    case "Diamante":
      return "#22d3ee";
    case "Oro":
      return "#fbbf24";
    case "Plata":
      return "#cbd5e1";
    default:
      return "#fb923c";
  }
}

export function winRate(stats: Pick<PlayerStats, "wins" | "losses" | "draws">): number {
  const total = stats.wins + stats.losses + stats.draws;
  if (total === 0) return 0;
  return Math.round((stats.wins / total) * 100);
}
