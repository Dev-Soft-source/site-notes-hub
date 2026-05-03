import { NextResponse } from "next/server";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdmin, verifyIdTokenFromHeader } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const uid = await verifyIdTokenFromHeader(req.headers.get("authorization"));
    initFirebaseAdmin();
    const db = getFirestore();

    const { projectId, title, body } = await req.json();
    if (!projectId || typeof projectId !== "string" || !title || typeof title !== "string") {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    const msgBody = typeof body === "string" ? body : null;

    const membersSnap = await db.collection("project_members").where("project_id", "==", projectId).get();
    const recipients = membersSnap.docs
      .map((d) => d.data().user_id as string)
      .filter((id) => id !== uid);

    if (recipients.length === 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    const batch = db.batch();
    for (const user_id of recipients) {
      const ref = db.collection("notifications").doc();
      batch.set(ref, {
        user_id,
        project_id: projectId,
        title,
        body: msgBody,
        read_at: null,
        created_at: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    return NextResponse.json({ ok: true, count: recipients.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
