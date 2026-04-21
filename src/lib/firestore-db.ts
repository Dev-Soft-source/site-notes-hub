/**
 * Client-side Firestore helpers (Firebase Auth session).
 * Requires Firestore indexes for compound queries — deploy `firestore.indexes.json` / console links from runtime errors.
 */
import {
  Timestamp,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  addDoc,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  getCountFromServer,
} from "firebase/firestore";
import { nanoid } from "nanoid";
import { getFirestoreDb } from "@/integrations/firebase/client";

export const COL = {
  projects: "projects",
  project_updates: "project_updates",
  drawings: "drawings",
  profiles: "profiles",
  project_members: "project_members",
  project_invites: "project_invites",
  notifications: "notifications",
  /** Doc id = qr_token; holds project_id for secure QR lookup without listing all projects. */
  qr_redirects: "qr_redirects",
} as const;

export function timestampToIso(v: Timestamp | Date | string | undefined | null): string {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  return v.toISOString();
}

export interface ProjectDoc {
  id: string;
  name: string;
  site_address: string | null;
  description: string | null;
  qr_token: string;
  created_by: string;
  created_at: string;
}

export interface UpdateDoc {
  id: string;
  kind: string;
  body: string | null;
  audio_path: string | null;
  transcription: string | null;
  transcription_status: string | null;
  created_at: string;
  author_id: string;
  project_id: string;
}

export interface DrawingDoc {
  id: string;
  name: string;
  original_path: string;
  qr_pdf_path: string | null;
  mime_type: string | null;
  project_id: string;
  uploaded_by: string;
  created_at: string;
}

export interface MemberProfile {
  user_id: string;
  email: string | null;
  full_name: string | null;
}

export interface NotificationDoc {
  id: string;
  title: string;
  body: string | null;
  project_id: string | null;
  read_at: string | null;
  created_at: string;
  user_id: string;
}

function projectFromSnap(s: DocumentSnapshot): ProjectDoc | null {
  if (!s.exists()) return null;
  const d = s.data()!;
  return {
    id: s.id,
    name: d.name as string,
    site_address: (d.site_address as string) ?? null,
    description: (d.description as string) ?? null,
    qr_token: d.qr_token as string,
    created_by: d.created_by as string,
    created_at: timestampToIso(d.created_at as Timestamp),
  };
}

function updateFromSnap(s: QueryDocumentSnapshot): UpdateDoc {
  const d = s.data();
  return {
    id: s.id,
    kind: d.kind as string,
    body: (d.body as string) ?? null,
    audio_path: (d.audio_path as string) ?? null,
    transcription: (d.transcription as string) ?? null,
    transcription_status: (d.transcription_status as string) ?? null,
    created_at: timestampToIso(d.created_at as Timestamp),
    author_id: d.author_id as string,
    project_id: d.project_id as string,
  };
}

function drawingFromSnap(s: QueryDocumentSnapshot): DrawingDoc {
  const d = s.data();
  return {
    id: s.id,
    name: d.name as string,
    original_path: d.original_path as string,
    qr_pdf_path: (d.qr_pdf_path as string) ?? null,
    mime_type: (d.mime_type as string) ?? null,
    project_id: d.project_id as string,
    uploaded_by: d.uploaded_by as string,
    created_at: timestampToIso(d.created_at as Timestamp),
  };
}

export async function listProjectsForUser(uid: string): Promise<ProjectDoc[]> {
  const db = getFirestoreDb();
  const mq = query(collection(db, COL.project_members), where("user_id", "==", uid));
  const ms = await getDocs(mq);
  const ids = [...new Set(ms.docs.map((d) => d.data().project_id as string))];
  const out: ProjectDoc[] = [];
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    const pq = query(collection(db, COL.projects), where(documentId(), "in", chunk));
    const ps = await getDocs(pq);
    ps.docs.forEach((docSnap) => {
      const p = projectFromSnap(docSnap);
      if (p) out.push(p);
    });
  }
  out.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return out;
}

export async function countUnreadNotifications(uid: string): Promise<number> {
  const db = getFirestoreDb();
  const q = query(collection(db, COL.notifications), where("user_id", "==", uid), where("read_at", "==", null));
  const agg = await getCountFromServer(q);
  return agg.data().count;
}

export async function findProjectByQrToken(token: string): Promise<ProjectDoc | null> {
  const db = getFirestoreDb();
  const linkSnap = await getDoc(doc(db, COL.qr_redirects, token));
  if (linkSnap.exists()) {
    const pid = linkSnap.data()?.project_id as string | undefined;
    if (pid) return getProject(pid);
  }
  const q = query(collection(db, COL.projects), where("qr_token", "==", token), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return projectFromSnap(snap.docs[0]);
}

export async function getProject(projectId: string): Promise<ProjectDoc | null> {
  const db = getFirestoreDb();
  const s = await getDoc(doc(db, COL.projects, projectId));
  return projectFromSnap(s);
}

export async function createProject(input: {
  name: string;
  site_address: string | null;
  description: string | null;
  created_by: string;
}): Promise<string> {
  const db = getFirestoreDb();
  const qr_token = nanoid(16);
  const ref = doc(collection(db, COL.projects));
  const batch = writeBatch(db);
  batch.set(ref, {
    name: input.name,
    site_address: input.site_address,
    description: input.description,
    created_by: input.created_by,
    qr_token,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  const memberId = `${ref.id}_${input.created_by}`;
  batch.set(doc(db, COL.project_members, memberId), {
    project_id: ref.id,
    user_id: input.created_by,
    role: "owner",
    created_at: serverTimestamp(),
  });
  batch.set(doc(db, COL.qr_redirects, qr_token), {
    project_id: ref.id,
    created_at: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}

export async function listUpdates(projectId: string): Promise<UpdateDoc[]> {
  const db = getFirestoreDb();
  const q = query(
    collection(db, COL.project_updates),
    where("project_id", "==", projectId),
    orderBy("created_at", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map(updateFromSnap);
}

export async function listDrawings(projectId: string): Promise<DrawingDoc[]> {
  const db = getFirestoreDb();
  const q = query(
    collection(db, COL.drawings),
    where("project_id", "==", projectId),
    orderBy("created_at", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map(drawingFromSnap);
}

export async function listMemberUserIds(projectId: string): Promise<string[]> {
  const db = getFirestoreDb();
  const q = query(collection(db, COL.project_members), where("project_id", "==", projectId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data().user_id as string);
}

export async function fetchProfilesForUserIds(ids: string[]): Promise<MemberProfile[]> {
  if (ids.length === 0) return [];
  const db = getFirestoreDb();
  const byId = new Map<string, MemberProfile>();
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    const pq = query(collection(db, COL.profiles), where(documentId(), "in", chunk));
    const snap = await getDocs(pq);
    snap.docs.forEach((s) => {
      const d = s.data();
      byId.set(s.id, {
        user_id: s.id,
        email: (d.email as string) ?? null,
        full_name: (d.full_name as string) ?? null,
      });
    });
  }
  return ids.map((uid) => byId.get(uid) ?? { user_id: uid, email: null, full_name: null });
}

export async function insertNote(projectId: string, authorId: string, body: string): Promise<void> {
  const db = getFirestoreDb();
  await addDoc(collection(db, COL.project_updates), {
    project_id: projectId,
    author_id: authorId,
    kind: "note",
    body,
    audio_path: null,
    transcription: null,
    transcription_status: null,
    created_at: serverTimestamp(),
  });
}

export async function insertVoiceUpdate(
  projectId: string,
  authorId: string,
  audioPath: string,
): Promise<string> {
  const db = getFirestoreDb();
  const docRef = await addDoc(collection(db, COL.project_updates), {
    project_id: projectId,
    author_id: authorId,
    kind: "voice",
    body: null,
    audio_path: audioPath,
    transcription: null,
    transcription_status: "pending",
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function insertDrawingMeta(input: {
  project_id: string;
  uploaded_by: string;
  name: string;
  original_path: string;
  mime_type: string | null;
}): Promise<void> {
  const db = getFirestoreDb();
  await addDoc(collection(db, COL.drawings), {
    ...input,
    qr_pdf_path: null,
    created_at: serverTimestamp(),
  });
}

export async function findProfileByEmail(emailLower: string): Promise<{ user_id: string } | null> {
  const db = getFirestoreDb();
  const q = query(collection(db, COL.profiles), where("email", "==", emailLower), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { user_id: snap.docs[0].id };
}

/** Ensures `profiles/{uid}` exists for invite matching and member display. */
export async function upsertOwnProfile(
  uid: string,
  fields: { email: string | null; full_name: string | null },
): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(
    doc(db, COL.profiles, uid),
    {
      email: fields.email,
      full_name: fields.full_name,
      updated_at: serverTimestamp(),
    },
    { merge: true },
  );
}

async function setMemberDoc(projectId: string, userId: string, role: string): Promise<void> {
  const db = getFirestoreDb();
  const mid = `${projectId}_${userId}`;
  const batch = writeBatch(db);
  batch.set(
    doc(db, COL.project_members, mid),
    {
      project_id: projectId,
      user_id: userId,
      role,
      created_at: serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();
}

export async function ensureProjectMember(projectId: string, userId: string, role: string): Promise<void> {
  await setMemberDoc(projectId, userId, role);
}

export async function addProjectInvite(projectId: string, email: string, invitedBy: string): Promise<void> {
  const db = getFirestoreDb();
  await addDoc(collection(db, COL.project_invites), {
    project_id: projectId,
    email,
    invited_by: invitedBy,
    accepted: false,
    created_at: serverTimestamp(),
  });
}

/** Live notifications list for the notifications screen. */
export function subscribeNotificationsList(
  uid: string,
  onNext: (items: NotificationDoc[]) => void,
): () => void {
  const db = getFirestoreDb();
  const q = query(
    collection(db, COL.notifications),
    where("user_id", "==", uid),
    orderBy("created_at", "desc"),
    limit(100),
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((s) => {
      const d = s.data();
      return {
        id: s.id,
        title: d.title as string,
        body: (d.body as string) ?? null,
        project_id: (d.project_id as string) ?? null,
        read_at: d.read_at == null ? null : timestampToIso(d.read_at as Timestamp),
        created_at: timestampToIso(d.created_at as Timestamp),
        user_id: d.user_id as string,
      };
    });
    onNext(items);
  });
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getFirestoreDb();
  const batch = writeBatch(db);
  const now = Timestamp.now();
  ids.forEach((id) => {
    batch.update(doc(db, COL.notifications, id), { read_at: now });
  });
  await batch.commit();
}

export async function markNotificationRead(id: string): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, COL.notifications, id), { read_at: Timestamp.now() });
}

/** Live project updates for one project. */
export function subscribeProjectUpdates(
  projectId: string,
  onNext: (updates: UpdateDoc[]) => void,
): () => void {
  const db = getFirestoreDb();
  const q = query(
    collection(db, COL.project_updates),
    where("project_id", "==", projectId),
    orderBy("created_at", "desc"),
  );
  return onSnapshot(q, (snap) => {
    onNext(snap.docs.map(updateFromSnap));
  });
}

/** Toast on new notifications for user (skips initial snapshot). */
export function subscribeUserNotifications(
  uid: string,
  onUnreadChange: () => void,
  onInsertToast?: (title: string, body?: string) => void,
): () => void {
  const db = getFirestoreDb();
  const q = query(collection(db, COL.notifications), where("user_id", "==", uid));
  let first = true;
  return onSnapshot(q, (snap) => {
    if (first) {
      first = false;
      onUnreadChange();
      return;
    }
    snap.docChanges().forEach((ch) => {
      if (ch.type === "added" && onInsertToast) {
        const d = ch.doc.data();
        onInsertToast(d.title as string, (d.body as string) ?? undefined);
      }
    });
    onUnreadChange();
  });
}
