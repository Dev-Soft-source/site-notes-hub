import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, MapPin, FileText, Users, Send, Mic, Loader2, Download, QrCode, Printer } from "lucide-react";
import { toast } from "sonner";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { generateCoverSheetPDF, generateDrawingWithQrPDF } from "@/lib/pdf";

interface Project {
  id: string; name: string; site_address: string | null; description: string | null;
  qr_token: string; created_by: string;
}
interface Update {
  id: string; kind: string; body: string | null; audio_path: string | null;
  transcription: string | null; transcription_status: string | null;
  created_at: string; author_id: string;
}
interface Drawing { id: string; name: string; original_path: string; qr_pdf_path: string | null; }
interface Member { user_id: string; email: string | null; full_name: string | null; }

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const nav = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tab, setTab] = useState<"updates" | "drawings" | "team">("updates");
  const [noteText, setNoteText] = useState("");
  const [posting, setPosting] = useState(false);
  const [uploadingDrawing, setUploadingDrawing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [printingLatest, setPrintingLatest] = useState(false);

  const projectUrl = project ? `${window.location.origin}/p/${project.qr_token}` : "";

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      setProject(p as Project | null);
      const { data: u } = await supabase.from("project_updates").select("*").eq("project_id", id).order("created_at", { ascending: false });
      setUpdates((u as Update[]) || []);
      const { data: d } = await supabase.from("drawings").select("*").eq("project_id", id).order("created_at", { ascending: false });
      setDrawings((d as Drawing[]) || []);
      const { data: m } = await supabase.from("project_members").select("user_id").eq("project_id", id);
      if (m && m.length) {
        const ids = m.map((x: any) => x.user_id);
        const { data: profs } = await supabase.from("profiles").select("user_id, email, full_name").in("user_id", ids);
        setMembers((profs as Member[]) || []);
      }
    };
    load();

    // Realtime: live updates feed
    const channel = supabase
      .channel(`project-updates-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "project_updates", filter: `project_id=eq.${id}` },
        (payload) => {
          const newUpd = payload.new as Update;
          setUpdates((prev) => prev.some((x) => x.id === newUpd.id) ? prev : [newUpd, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "project_updates", filter: `project_id=eq.${id}` },
        (payload) => {
          const upd = payload.new as Update;
          setUpdates((prev) => prev.map((x) => x.id === upd.id ? upd : x));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const refreshUpdates = async () => {
    if (!id) return;
    const { data } = await supabase.from("project_updates").select("*").eq("project_id", id).order("created_at", { ascending: false });
    setUpdates((data as Update[]) || []);
  };

  const postNote = async () => {
    if (!project || !user || !noteText.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("project_updates").insert({
      project_id: project.id, author_id: user.id, kind: "note", body: noteText.trim(),
    });
    if (error) { toast.error(error.message); setPosting(false); return; }
    setNoteText("");
    await refreshUpdates();
    setPosting(false);
    toast.success("Note posted");
    supabase.functions.invoke("notify-members", {
      body: { projectId: project.id, title: `New note on ${project.name}`, body: noteText.trim().slice(0, 200) },
    });
  };

  const handleVoiceUpload = async (blob: Blob) => {
    if (!project || !user) return;
    const ext = blob.type.includes("mp4") ? "m4a" : "webm";
    const path = `${project.id}/${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("voice-notes").upload(path, blob, { contentType: blob.type });
    if (upErr) { toast.error(upErr.message); return; }

    const { data: insErr, error: insertErr } = await supabase.from("project_updates").insert({
      project_id: project.id, author_id: user.id, kind: "voice", audio_path: path, transcription_status: "pending",
    }).select("id").single();
    if (insertErr || !insErr) { toast.error(insertErr?.message || "Failed"); return; }

    await refreshUpdates();
    toast.success("Voice note uploaded — transcribing…");

    // Trigger transcription
    const { error: fnErr } = await supabase.functions.invoke("transcribe-voice", { body: { updateId: insErr.id } });
    if (fnErr) toast.error("Transcription failed: " + fnErr.message);
    await refreshUpdates();

    supabase.functions.invoke("notify-members", {
      body: { projectId: project.id, title: `New voice note on ${project.name}`, body: "A voice note was added." },
    });
  };

  const handleDrawingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !project || !user) return;
    setUploadingDrawing(true);
    try {
      const path = `${project.id}/${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("drawings").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { error: insErr } = await supabase.from("drawings").insert({
        project_id: project.id, uploaded_by: user.id, name: file.name, original_path: path, mime_type: file.type,
      });
      if (insErr) throw insErr;
      const { data } = await supabase.from("drawings").select("*").eq("project_id", project.id).order("created_at", { ascending: false });
      setDrawings((data as Drawing[]) || []);
      toast.success("Drawing uploaded");
    } catch (e: any) { toast.error(e.message); } finally { setUploadingDrawing(false); }
  };

  const downloadCoverSheet = async (drawing: Drawing) => {
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
      a.href = url; a.download = `${project.name}-${drawing.name}-coversheet.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e: any) { toast.error("PDF failed: " + e.message); } finally { setGeneratingPdf(null); }
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
    a.href = url; a.download = `${project.name}-QR.pdf`;
    a.click(); URL.revokeObjectURL(url);
  };

  const openDrawing = async (path: string) => {
    const { data, error } = await supabase.storage.from("drawings").createSignedUrl(path, 600);
    if (error || !data) { toast.error("Could not open"); return; }
    window.open(data.signedUrl, "_blank");
  };

  if (!project) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="gradient-primary text-primary-foreground px-5 pt-12 pb-6 safe-pt rounded-b-3xl shadow-elevated">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => nav("/")} className="size-10 -ml-2 grid place-items-center rounded-full active:bg-white/20">
            <ChevronLeft className="size-6" />
          </button>
          <button onClick={downloadProjectQR} className="size-10 grid place-items-center rounded-full bg-white/10 active:bg-white/20" title="Download QR">
            <QrCode className="size-5" />
          </button>
        </div>
        <h1 className="text-2xl font-bold leading-tight">{project.name}</h1>
        {project.site_address && (
          <p className="text-sm opacity-80 mt-1 flex items-center gap-1"><MapPin className="size-3.5" /> {project.site_address}</p>
        )}
      </header>

      <div className="px-5 mt-4 grid grid-cols-3 gap-2 bg-secondary p-1 rounded-xl">
        {(["updates", "drawings", "team"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`py-2.5 rounded-lg text-sm font-medium capitalize transition ${tab === t ? "bg-card shadow-card text-foreground" : "text-muted-foreground"}`}>
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
          ) : updates.map((u) => (
            <div key={u.id} className="rounded-2xl bg-card shadow-card p-4">
              <div className="flex items-center gap-2 mb-2">
                {u.kind === "voice" ? <Mic className="size-4 text-accent" /> : <FileText className="size-4 text-primary" />}
                <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString()}</span>
              </div>
              {u.body && <p className="text-sm whitespace-pre-wrap">{u.body}</p>}
              {u.kind === "voice" && (
                <div className="mt-1">
                  {u.transcription_status === "pending" ? (
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Transcribing…</div>
                  ) : u.transcription_status === "failed" ? (
                    <div className="text-xs text-destructive">Transcription failed</div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{u.transcription}</p>
                  )}
                </div>
              )}
            </div>
          ))}
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
          {project.created_by === user?.id && (
            <Button asChild className="w-full h-12">
              <Link to={`/projects/${project.id}/invite`}><Users className="size-4 mr-2" /> Invite people</Link>
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
