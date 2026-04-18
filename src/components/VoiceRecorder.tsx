import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  onRecorded: (blob: Blob) => Promise<void> | void;
  disabled?: boolean;
}

export const VoiceRecorder = ({ onRecorded, disabled }: Props) => {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        setUploading(true);
        try { await onRecorded(blob); } finally { setUploading(false); setSeconds(0); }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e: any) {
      toast.error("Microphone access denied");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (uploading) {
    return (
      <Button disabled className="w-full h-14 text-base">
        <Loader2 className="size-5 mr-2 animate-spin" /> Uploading & transcribing…
      </Button>
    );
  }

  return recording ? (
    <Button onClick={stop} variant="destructive" className="w-full h-14 text-base font-semibold animate-pulse">
      <Square className="size-5 mr-2 fill-current" /> Stop · {fmt(seconds)}
    </Button>
  ) : (
    <Button onClick={start} disabled={disabled} className="w-full h-14 text-base font-semibold gradient-accent text-accent-foreground hover:opacity-90 shadow-accent-glow">
      <Mic className="size-5 mr-2" /> Record voice note
    </Button>
  );
};
