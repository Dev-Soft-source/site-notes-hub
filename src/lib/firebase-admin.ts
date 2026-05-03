import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/** Server-only: reuse single Admin app across API routes / server actions. */
export function initFirebaseAdmin(): App {
  if (getApps().length) return getApps()[0]!;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) {
    throw new Error(
      "Set FIREBASE_SERVICE_ACCOUNT_JSON to your Firebase service account JSON (required for protected API routes).",
    );
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON.");
  }
  return initializeApp({ credential: cert(parsed as Parameters<typeof cert>[0]) });
}

export async function verifyIdTokenFromHeader(authHeader: string | null): Promise<string> {
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.slice(7);
  initFirebaseAdmin();
  const decoded = await getAuth().verifyIdToken(token);
  return decoded.uid;
}
