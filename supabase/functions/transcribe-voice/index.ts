import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { updateId } = await req.json();
    if (!updateId || typeof updateId !== "string") {
      return new Response(JSON.stringify({ error: "updateId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await supabaseUser.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch update
    const { data: update, error: updErr } = await admin
      .from("project_updates").select("*").eq("id", updateId).maybeSingle();
    if (updErr || !update) throw new Error("update not found");
    if (!update.audio_path) throw new Error("no audio");

    // Download audio
    const { data: file, error: dlErr } = await admin.storage.from("voice-notes").download(update.audio_path);
    if (dlErr || !file) throw new Error("download failed: " + dlErr?.message);

    const buf = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const mime = file.type || "audio/webm";

    // Use Lovable AI gateway with multimodal input
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Transcribe this voice note from a construction site. Return ONLY the transcription text, no commentary." },
            { type: "input_audio", input_audio: { data: base64, format: mime.includes("mp3") ? "mp3" : "wav" } },
          ],
        }],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI error", aiRes.status, txt);
      await admin.from("project_updates").update({ transcription_status: "failed" }).eq("id", updateId);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit, try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI failed");
    }

    const ai = await aiRes.json();
    const text = ai.choices?.[0]?.message?.content?.trim() || "";

    await admin.from("project_updates")
      .update({ transcription: text, transcription_status: "done" })
      .eq("id", updateId);

    return new Response(JSON.stringify({ transcription: text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
