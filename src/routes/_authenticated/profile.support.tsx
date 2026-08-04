import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImageIcon, Loader2, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, submitSupport } from "@/lib/profile.functions";
import { compressImage, isAcceptedImage } from "@/lib/image-utils";
import { PageShell, Card } from "@/components/PageShell";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/profile/support")({
  head: () => ({
    meta: [
      { title: "Contact Support — Niza AI" },
      { name: "description", content: "Report a problem or ask the Niza AI Support Team for help." },
      { property: "og:title", content: "Contact Support — Niza AI" },
      { property: "og:description", content: "Report a problem or ask the Niza AI Support Team for help." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Support,
});

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function Support() {
  const fetchProfile = useServerFn(getProfile);
  const send = useServerFn(submitSupport);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [shot, setShot] = useState<{ dataUrl: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function attach(file: File) {
    if (!isAcceptedImage(file)) return toast.error("Please choose a JPG, PNG or WEBP screenshot.");
    try {
      const c = await compressImage(file);
      setShot({ dataUrl: c.dataUrl, name: file.name });
    } catch {
      toast.error("We couldn't read that screenshot. Please try another one.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (subject.trim().length < 3) return toast.error("Please add a short subject.");
    if (message.trim().length < 10) return toast.error("Please describe the issue in a little more detail.");
    setBusy(true);
    try {
      let path: string | null = null;
      if (shot && profile) {
        const blob = dataUrlToBlob(shot.dataUrl);
        const key = `${profile.id}/support-${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from("support-uploads")
          .upload(key, blob, { contentType: blob.type, upsert: true });
        if (!error) path = key;
      }
      const diagnostics = {
        appVersion: "Niza AI",
        device: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screen: `${window.screen.width}x${window.screen.height}`,
        online: navigator.onLine,
        at: new Date().toISOString(),
      };
      const res = await send({ data: { subject, message, screenshot_path: path, diagnostics } });
      if (res.ok) {
        setSent(true);
        setSubject("");
        setMessage("");
        setShot(null);
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("We couldn't send your message right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Contact Support" subtitle="We usually reply within a day">
      <div className="space-y-5">
        {sent && (
          <Card className="border-emerald-500/40 bg-emerald-500/10 text-sm">
            Our Support Team has received your request and will review it as soon as possible.
          </Card>
        )}

        <Card>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="subject">
                Subject
              </label>
              <input
                id="subject"
                value={subject}
                maxLength={140}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What is this about?"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="message">
                Describe the issue
              </label>
              <textarea
                id="message"
                value={message}
                maxLength={6000}
                rows={7}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what happened, what you expected, and the steps you took."
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              {shot ? (
                <div className="flex items-center gap-3 rounded-lg border border-border p-2">
                  <img src={shot.dataUrl} alt="" className="h-14 w-14 rounded-md object-cover" />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{shot.name}</span>
                  <button
                    type="button"
                    onClick={() => setShot(null)}
                    className="rounded-md p-1 hover:bg-accent"
                    aria-label="Remove screenshot"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground hover:bg-accent"
                >
                  <ImageIcon className="h-4 w-4" /> Attach a screenshot (optional)
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) attach(f);
                }}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Basic device details are included automatically so our Support Team can reproduce the problem faster.
            </p>

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {busy ? "Sending…" : "Send to Support"}
            </button>
          </form>
        </Card>
      </div>
    </PageShell>
  );
}
