import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { ensureAuth, getDisplayName, getStoredDisplayName } from "../lib/auth";

interface AuthContextValue {
  user: User | null;
  displayName: string;
  loading: boolean;
  setDisplayName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayNameState] = useState(getStoredDisplayName());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      if (nextUser) {
        setUser(nextUser);
        setDisplayNameState(getDisplayName(nextUser));
        setLoading(false);
        return;
      }

      try {
        const authed = await ensureAuth(getStoredDisplayName());
        setUser(authed);
        setDisplayNameState(getDisplayName(authed));
      } catch (error) {
        console.error("[AuthProvider]", error);
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, []);

  const setDisplayName = async (name: string) => {
    const authed = await ensureAuth(name);
    setUser(authed);
    setDisplayNameState(getDisplayName(authed));
  };

  const value = useMemo(
    () => ({ user, displayName, loading, setDisplayName }),
    [user, displayName, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
