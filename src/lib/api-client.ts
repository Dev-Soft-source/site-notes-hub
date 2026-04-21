import type { Auth } from "firebase/auth";

/** POST JSON with Firebase ID token for `/api/*` routes that verify the caller. */
export async function apiPostJsonWithAuth(auth: Auth | null, path: string, body: Record<string, unknown>): Promise<Response> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Not signed in");
  const idToken = await user.getIdToken();
  return fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
}
