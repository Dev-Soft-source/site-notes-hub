"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { getFirebaseAuth } from "@/integrations/firebase/client";
import { useAuth } from "@/auth/AuthContext";
import { apiPostJsonWithAuth } from "@/lib/api-client";
import {
  type ProjectDoc,
  type UpdateDoc,
  type DrawingDoc,
  type MemberProfile,
  fetchProfilesForUserIds,
  getProject,
  insertDrawingMeta,
  insertNote,
  insertVoiceUpdate,
  listDrawings,
  listMemberUserIds,
  listUpdates,
  subscribeProjectUpdates,
} from "@/lib/firestore-db";
import { getDrawingDownloadURL, uploadDrawingBytes, uploadVoiceBytes } from "@/lib/storage-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, MapPin, FileText, Users, Send, Mic, Loader2, Download, QrCode, Printer } from "lucide-react";
import { toast } from "sonner";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { generateCoverSheetPDF, generateDrawingWithQrPDF } from "@/lib/pdf";

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];
  const { user } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState<ProjectDoc | null>(null);
  const [updates, setUpdates] = useState<UpdateDoc[]>([]);
  const [drawings, setDrawings] = useState<DrawingDoc[]>([]);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [tab, setTab] = useState<"updates" | "drawings" | "team">("updates");
  const [noteText, setNoteText] = useState("");
  const [posting, setPosting] = useState(false);
  const [uploadingDrawing, setUploadingDrawing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [printingLatest, setPrintingLatest] = useState(false);

  const projectUrl = project ? `${window.location.origin}/p/${project.qr_token}` : "";

  const refreshUpdates = async () => {
    if (!id) return;
    setUpdates(await listUpdates(id));
  };

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const p = await getProject(id);
      setProject(p);
      if (p) {
        setUpdates(await listUpdates(id));
        setDrawings(await listDrawings(id));
        const mIds = await listMemberUserIds(id);
        if (mIds.length) {
          setMembers(await fetchProfilesForUserIds(mIds));
        } else {
          setMembers([]);
        }
      }
    };
    load();

    const unsub = subscribeProjectUpdates(id, (u) => setUpdates(u));
    return () => unsub();
  }, [id]);

  const postNote = async () => {
    if (!project || !user || !noteText.trim()) return;
    const body = noteText.trim();
    const notifyBody = body.slice(0, 200);
    setPosting(true);
    try {
      await insertNote(project.id, user.uid, body);
      setNoteText("");
      await refreshUpdates();
      toast.success("Note posted");
      const res = await apiPostJsonWithAuth(getFirebaseAuth(), "/api/notify-members", {
        projectId: project.id,
        title: `New note on ${project.name}`,
        body: notifyBody,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error((j as { error?: string }).error || "Could not notify team");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  };

  const handleVoiceUpload = async (blob: Blob) => {
    if (!project || !user) return;
    const ext = blob.type.includes("mp4") ? "m4a" : "webm";
    const path = `${project.id}/${user.uid}/${Date.now()}.${ext}`;
    try {
      await uploadVoiceBytes(path, blob);
      const updateId = await insertVoiceUpdate(project.id, user.uid, path);
      await refreshUpdates();
      toast.success("Voice note uploaded — transcribing…");

      const res = await apiPostJsonWithAuth(getFirebaseAuth(), "/api/transcribe-voice", { updateId });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error((j as { error?: string }).error || "Transcription failed");
      }
      await refreshUpdates();

      await apiPostJsonWithAuth(getFirebaseAuth(), "/api/notify-members", {
        projectId: project.id,
        title: `New voice note on ${project.name}`,
        body: "A voice note was added.",
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Voice upload failed");
    }
  };

  const handleDrawingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !project || !user) return;
    setUploadingDrawing(true);
    try {
      const path = `${project.id}/${user.uid}/${Date.now()}-${file.name}`;
      await uploadDrawingBytes(path, file);
      await insertDrawingMeta({
        project_id: project.id,
        uploaded_by: user.uid,
        name: file.name,
        original_path: path,
        mime_type: file.type,
      });
      setDrawings(await listDrawings(project.id));
      toast.success("Drawing uploaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingDrawing(false);
    }
  };

  const downloadCoverSheet = async (drawing: DrawingDoc) => {
    if (!project) return;
    setGeneratingPdf(drawing.id);
    try {
      const blob = await generateCoverSheetPDF({
        projectName: project.name,
        siteAddress: project.site_address,
        description: project.description,
        qrUrl: projectUrl,
        drawingName: drawing.name,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name}-${drawing.name}-coversheet.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      toast.error("PDF failed: " + (e instanceof Error ? e.message : ""));
    } finally {
      setGeneratingPdf(null);
    }
  };

  const downloadProjectQR = async () => {
    if (!project) return;
    const blob = await generateCoverSheetPDF({
      projectName: project.name,
      siteAddress: project.site_address,
      description: project.description,
      qrUrl: projectUrl,
      drawingName: "Project QR",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}-QR.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openDrawing = async (path: string) => {
    try {
      const url = await getDrawingDownloadURL(path);
      window.open(url, "_blank");
    } catch {
      toast.error("Could not open");
    }
  };

  const printLatestDrawing = async () => {
    if (!project) return;
    const latest = drawings[0];
    if (!latest) {
      toast.error("Upload a drawing first");
      return;
    }
    setPrintingLatest(true);
    try {
      const signedUrl = await getDrawingDownloadURL(latest.original_path);
      const fileRes = await fetch(signedUrl);
      const fileBlob = await fileRes.blob();

      const merged = await generateDrawingWithQrPDF({
        projectName: project.name,
        siteAddress: project.site_address,
        description: project.description,
        qrUrl: projectUrl,
        drawingName: latest.name,
        drawingBlob: fileBlob,
        drawingMimeType: latest.mime_type ?? fileBlob.type,
      });

      const url = URL.createObjectURL(merged);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name}-${latest.name.replace(/\.[^.]+$/, "")}-with-QR.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Ready to print");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not generate PDF");
    } finally {
      setPrintingLatest(false);
    }
  };

  if (!project) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="gradient-primary text-primary-foreground px-5 pt-12 pb-6 safe-pt rounded-b-3xl shadow-elevated">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => router.push("/")} className="size-10 -ml-2 grid place-items-center rounded-full active:bg-white/20">
            <ChevronLeft className="size-6" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={printLatestDrawing}
              disabled={printingLatest || drawings.length === 0}
              className="h-10 px-3 grid grid-flow-col items-center gap-1.5 rounded-full bg-white/10 active:bg-white/20 disabled:opacity-50 text-sm font-medium"
              title="Print latest drawing with QR"
            >
              {printingLatest ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
              <span>Print drawing</span>
            </button>
            <button onClick={downloadProjectQR} className="size-10 grid place-items-center rounded-full bg-white/10 active:bg-white/20" title="Download QR">
              <QrCode className="size-5" />
            </button>
          </div>
        </div>
        <h1 className="text-2xl font-bold leading-tight">{project.name}</h1>
        {project.site_address && (
          <p className="text-sm opacity-80 mt-1 flex items-center gap-1">
            <MapPin className="size-3.5" /> {project.site_address}
          </p>
        )}
      </header>

      <div className="px-5 mt-4 grid grid-cols-3 gap-2 bg-secondary p-1 rounded-xl">
        {(["updates", "drawings", "team"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2.5 rounded-lg text-sm font-medium capitalize transition ${tab === t ? "bg-card shadow-card text-foreground" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "updates" && (
        <div className="px-5 mt-5 space-y-3">
          {updates.length === 0 ? (
            <div className="rounded-2xl bg-card shadow-card p-6 text-center text-sm text-muted-foreground">
              No updates yet. Post a note or record a voice memo below.
            </div>
          ) : (
            updates.map((u) => (
              <div key={u.id} className="rounded-2xl bg-card shadow-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  {u.kind === "voice" ? <Mic className="size-4 text-accent" /> : <FileText className="size-4 text-primary" />}
                  <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString()}</span>
                </div>
                {u.body && <p className="text-sm whitespace-pre-wrap">{u.body}</p>}
                {u.kind === "voice" && (
                  <div className="mt-1">
                    {u.transcription_status === "pending" ? (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="size-3 animate-spin" /> Transcribing…
                      </div>
                    ) : u.transcription_status === "failed" ? (
                      <div className="text-xs text-destructive">Transcription failed</div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{u.transcription}</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "drawings" && (
        <div className="px-5 mt-5 space-y-3">
          <label className={`block rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center cursor-pointer active:scale-[0.99] transition ${uploadingDrawing ? "opacity-60" : ""}`}>
            <input type="file" accept="image/*,application/pdf" onChange={handleDrawingUpload} disabled={uploadingDrawing} className="hidden" />
            <div className="font-semibold text-sm">{uploadingDrawing ? "Uploading…" : "Upload drawing"}</div>
            <div className="text-xs text-muted-foreground mt-1">PDF or image · cover sheet will include QR</div>
          </label>
          {drawings.map((d) => (
            <div key={d.id} className="rounded-2xl bg-card shadow-card p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-secondary grid place-items-center flex-shrink-0">
                <FileText className="size-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <button onClick={() => openDrawing(d.original_path)} className="text-left block w-full">
                  <div className="font-medium truncate">{d.name}</div>
                  <div className="text-xs text-muted-foreground">Tap to open</div>
                </button>
              </div>
              <Button size="sm" variant="outline" disabled={generatingPdf === d.id} onClick={() => downloadCoverSheet(d)}>
                {generatingPdf === d.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              </Button>
            </div>
          ))}
        </div>
      )}

      {tab === "team" && (
        <div className="px-5 mt-5 space-y-3">
          {project.created_by === user?.uid && (
            <Button asChild className="w-full h-12">
              <Link href={`/projects/${project.id}/invite`}>
                <Users className="size-4 mr-2" /> Invite people
              </Link>
            </Button>
          )}
          {members.map((m) => (
            <div key={m.user_id} className="rounded-2xl bg-card shadow-card p-4 flex items-center gap-3">
              <div className="size-10 rounded-full gradient-primary grid place-items-center text-primary-foreground font-bold">
                {(m.full_name || m.email || "?").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="font-medium">{m.full_name || m.email}</div>
                {m.email && m.full_name && <div className="text-xs text-muted-foreground">{m.email}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "updates" && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 safe-pb space-y-2 shadow-elevated">
          <div className="flex gap-2">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Quick note…"
              maxLength={1000}
              className="min-h-12 max-h-32 resize-none text-base"
              rows={1}
            />
            <Button onClick={postNote} disabled={!noteText.trim() || posting} size="icon" className="size-12 flex-shrink-0">
              <Send className="size-5" />
            </Button>
          </div>
          <VoiceRecorder onRecorded={handleVoiceUpload} />
        </div>
      )}
    </div>
  );
}
