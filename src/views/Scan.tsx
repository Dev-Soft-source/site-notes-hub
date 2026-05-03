"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export default function Scan() {
  const router = useRouter();
  const elRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = "qr-region";
    const el = document.getElementById(id);
    if (!el) return;
    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;

    const safeStop = async () => {
      const s = scannerRef.current;
      if (!s) return;
      try {
        const state = s.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await s.stop();
        }
      } catch {
        /* ignore stop errors */
      }
      try {
        s.clear();
      } catch {
        /* ignore clear */
      }
    };

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (text) => {
        safeStop();
        try {
          const url = new URL(text);
          const m = url.pathname.match(/^\/p\/([^/]+)/);
          if (m) { router.push(`/p/${m[1]}`); return; }
        } catch {
          /* invalid URL */
        }
        toast.error("That QR doesn't look like a SiteSync code");
        router.push("/");
      },
      () => undefined
    ).catch((e) => setError(e?.message || "Camera unavailable"));

    return () => { safeStop(); };
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white safe-pt">
      <header className="px-5 pt-4 pb-3 flex items-center gap-2 absolute top-0 left-0 right-0 z-10">
        <button onClick={() => router.back()} className="size-10 -ml-2 grid place-items-center rounded-full bg-white/10 backdrop-blur active:bg-white/20">
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
