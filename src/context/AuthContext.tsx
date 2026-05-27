import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { getDisplayName, loginWithGoogle, logout } from "../lib/auth";
import { ensurePlayerProfile, getPlayerStats } from "../lib/stats";
import type { PlayerStats } from "../types/player";

interface AuthContextValue {
  user: User | null;
  displayName: string;
  stats: PlayerStats | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshStats: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStats = useCallback(async () => {
    if (!auth.currentUser) {
      setStats(null);
      return;
    }
    const next = await getPlayerStats(auth.currentUser.uid);
    setStats(next);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        try {
          const profile = await ensurePlayerProfile(nextUser);
          setStats(profile);
        } catch (error) {
          console.error("[AuthProvider]", error);
        }
      } else {
        setStats(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    const authed = await loginWithGoogle();
    setUser(authed);
    const profile = await ensurePlayerProfile(authed);
    setStats(profile);
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setStats(null);
  };

  const value = useMemo(
    () => ({
      user,
      displayName: user ? getDisplayName(user) : "",
      stats,
      loading,
      loginWithGoogle: handleLogin,
      logout: handleLogout,
      refreshStats,
    }),
    [user, stats, loading, refreshStats]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
