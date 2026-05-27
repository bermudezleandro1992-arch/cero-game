import {
  signInAnonymously,
  onAuthStateChanged,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";

const DISPLAY_NAME_KEY = "cero_display_name";

export function getStoredDisplayName(): string {
  return localStorage.getItem(DISPLAY_NAME_KEY) ?? "";
}

export function setStoredDisplayName(name: string): void {
  localStorage.setItem(DISPLAY_NAME_KEY, name.trim());
}

export function waitForAuthUser(): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsub();
          resolve(user);
        }
      },
      (error) => {
        unsub();
        reject(error);
      }
    );
  });
}

export async function ensureAuth(displayName?: string): Promise<User> {
  if (auth.currentUser) {
    const name = displayName?.trim() || getStoredDisplayName();
    if (name && auth.currentUser.displayName !== name) {
      await updateProfile(auth.currentUser, { displayName: name });
      if (displayName) setStoredDisplayName(name);
    }
    return auth.currentUser;
  }

  const cred = await signInAnonymously(auth);
  const name = displayName?.trim() || getStoredDisplayName() || "Jugador";
  await updateProfile(cred.user, { displayName: name });
  setStoredDisplayName(name);
  return cred.user;
}

export function getDisplayName(user: User): string {
  return user.displayName?.trim() || getStoredDisplayName() || "Jugador";
}
