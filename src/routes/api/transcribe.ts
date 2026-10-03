import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const MAX_BYTES = 20 * 1024 * 1024;

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "Please sign in again." }, { status: 401 });
        const url = process.env["SUPABASE_URL"]!;
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const sb = createClient(url, key, { auth: { persistSession: false } });
        const { data: u, error: authErr } = await sb.auth.getUser(token);
        if (authErr || !u.user) return Response.json({ error: "Please sign in again." }, { status: 401 });

        const form = await request.formData().catch(() => null);
        const file = form?.get("file");
        if (!(file instanceof File) || !file.size || file.size > MAX_BYTES || !file.type.startsWith("audio/")) {
          return Response.json({ error: "That recording couldn't be read. Please try again." }, { status: 400 });
        }
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return Response.json({ error: "Voice input is not configured." }, { status: 500 });

        const out = new FormData();
        out.append("model", "google/gemini-3.5-transcribe");
        out.append("file", file, "recording.wav");
        out.append("response_format", "json");
        const lang = String(form?.get("language") ?? "").slice(0, 8);
        if (/^[a-z]{2}$/i.test(lang)) out.append("language", lang.toLowerCase());

        const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "X-Lovable-AIG-SDK": "fetch" },
          body: out,
        });
        if (!r.ok) {
          const body = await r.text();
          console.error(`[transcribe] ${r.status}: ${body}`);
          const msg =
            r.status === 429
              ? "Voice input is busy. Please try again in a moment."
              : r.status === 402
                ? "Voice input is temporarily unavailable."
                : "Transcription failed. Please try again.";
          return Response.json({ error: msg, retryable: r.status === 429 || r.status >= 500 }, { status: r.status });
        }
        const raw = await r.text();
        let text = "";
        try {
          text = String(JSON.parse(raw)?.text ?? "");
        } catch {
          // SSE fallback: collect deltas / final text
          for (const line of raw.split("\n")) {
            if (!line.startsWith("data:")) continue;
            try {
              const ev = JSON.parse(line.slice(5));
              if (ev.type?.endsWith(".done") && ev.text) text = ev.text;
              else if (ev.delta) text += ev.delta;
            } catch {}
          }
        }
        return Response.json({ text: text.trim() });
      },
    },
  },
});
