import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import { ensurePlayerProfile } from "./stats";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export function waitForAuthUser(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, provider);
  await ensurePlayerProfile(result.user);
  return result.user;
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export function getDisplayName(user: User): string {
  return user.displayName?.trim() || user.email?.split("@")[0] || "Jugador";
}

export function getPhotoURL(user: User): string | null {
  return user.photoURL || null;
}

export function isGoogleUser(user: User): boolean {
  return user.providerData.some((p) => p.providerId === "google.com");
}
