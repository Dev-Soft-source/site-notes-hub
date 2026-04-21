import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export default function Scan() {
  const nav = useNavigate();
  const elRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = "qr-region";
    const el = document.getElementById(id);
    if (!el) return;
    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (text) => {
        scanner.stop().catch(() => {});
        try {
          const url = new URL(text);
          const m = url.pathname.match(/^\/p\/([^/]+)/);
          if (m) { nav(`/p/${m[1]}`); return; }
        } catch {}
        toast.error("That QR doesn't look like a SiteSync code");
        nav("/");
      },
      () => {}
    ).catch((e) => setError(e?.message || "Camera unavailable"));

    return () => { scannerRef.current?.stop().catch(() => {}); };
  }, [nav]);

  return (
    <div className="min-h-screen bg-black text-white safe-pt">
      <header className="px-5 pt-4 pb-3 flex items-center gap-2 absolute top-0 left-0 right-0 z-10">
        <button onClick={() => nav(-1)} className="size-10 -ml-2 grid place-items-center rounded-full bg-white/10 backdrop-blur active:bg-white/20">
          <ChevronLeft className="size-6" />
        </button>
        <h1 className="text-lg font-semibold">Scan project QR</h1>
      </header>
      <div id="qr-region" ref={elRef} className="w-full" />
      {error && <p className="px-5 mt-4 text-destructive text-sm">{error}</p>}
      <p className="absolute bottom-10 left-0 right-0 text-center text-sm opacity-80 px-6">
        Point camera at the QR on a printed drawing
      </p>
    </div>
  );
}
