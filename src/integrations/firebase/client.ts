import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth, signInAnonymously as firebaseSignInAnonymously } from "firebase/auth";
import {
  type Firestore,
  getFirestore as initFirestore,
} from "firebase/firestore";
import { type FirebaseStorage, getStorage as initStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True when all required web config fields are present (optional bucket/sender may be omitted). */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (!getApps().length) {
    return initializeApp(firebaseConfig);
  }
  return getApps()[0]!;
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
}

export function getFirestoreDb(): Firestore {
  const app = getFirebaseApp();
  if (!app) throw new Error("Firebase is not configured (missing NEXT_PUBLIC_FIREBASE_* env).");
  return initFirestore(app);
}

export function getFirebaseStorageClient(): FirebaseStorage {
  const app = getFirebaseApp();
  if (!app) throw new Error("Firebase is not configured (missing NEXT_PUBLIC_FIREBASE_* env).");
  return initStorage(app);
}

/** Ensures an anonymous Firebase session when Auth is configured (public routes e.g. QR landing). */
export async function ensureFirebaseAnonymousSession(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await auth.authStateReady();
  if (!auth.currentUser) {
    await firebaseSignInAnonymously(auth);
  }
}
