import { NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { initFirebaseAdmin, verifyIdTokenFromHeader } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const uid = await verifyIdTokenFromHeader(req.headers.get("authorization"));
    initFirebaseAdmin();

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) {
      return NextResponse.json({ error: "LOVABLE_API_KEY not configured on server" }, { status: 503 });
    }

    const { updateId } = await req.json();
    if (!updateId || typeof updateId !== "string") {
      return NextResponse.json({ error: "updateId required" }, { status: 400 });
    }

    const db = getFirestore();
    const updRef = db.collection("project_updates").doc(updateId);
    const updSnap = await updRef.get();
    if (!updSnap.exists) {
      return NextResponse.json({ error: "update not found" }, { status: 404 });
    }

    const update = updSnap.data()!;
    const authorId = update.author_id as string;
    if (authorId !== uid) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const audioPath = update.audio_path as string | undefined;
    if (!audioPath) {
      return NextResponse.json({ error: "no audio" }, { status: 400 });
    }

    const bucket = getStorage().bucket();
    const file = bucket.file(audioPath);
    const [buf] = await file.download();
    const base64 = buf.toString("base64");
    const mime = file.metadata.contentType || "audio/webm";

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe this voice note from a construction site. Return ONLY the transcription text, no commentary.",
              },
              {
                type: "input_audio",
                input_audio: { data: base64, format: mime.includes("mp3") ? "mp3" : "wav" },
              },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI error", aiRes.status, txt);
      await updRef.update({ transcription_status: "failed" });
      if (aiRes.status === 429) {
        return NextResponse.json({ error: "Rate limit, try again later." }, { status: 429 });
      }
      if (aiRes.status === 402) {
        return NextResponse.json({ error: "AI credits exhausted." }, { status: 402 });
      }
      return NextResponse.json({ error: "AI failed" }, { status: 502 });
    }

    const ai = await aiRes.json();
    const text = (ai.choices?.[0]?.message?.content as string)?.trim() || "";

    await updRef.update({
      transcription: text,
      transcription_status: "done",
    });

    return NextResponse.json({ transcription: text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status = msg === "Unauthorized" ? 401 : msg.includes("FIREBASE_SERVICE_ACCOUNT") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
