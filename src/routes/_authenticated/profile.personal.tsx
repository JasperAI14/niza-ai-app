import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, Check, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { checkUsername, getProfile, updateProfile } from "@/lib/profile.functions";
import { compressImage, isAcceptedImage } from "@/lib/image-utils";
import { PageShell, Card } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/profile/personal")({
  head: () => ({
    meta: [
      { title: "Personal Information — Niza Prime AI" },
      { name: "description", content: "Update your Niza Prime AI profile picture, display name and username." },
      { property: "og:title", content: "Personal Information — Niza Prime AI" },
      { property: "og:description", content: "Update your Niza Prime AI profile picture, display name and username." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PersonalInfo,
});

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function PersonalInfo() {
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getProfile);
  const saveProfile = useServerFn(updateProfile);
  const verifyUsername = useServerFn(checkUsername);
  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameStatus, setNameStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    setName(data.display_name ?? "");
    setUsername(data.username ?? "");
    setPreview(data.avatar_url);
  }, [data?.id]);

  useEffect(() => {
    const u = username.trim().toLowerCase();
    if (!u || u === (data?.username ?? "")) return setNameStatus(null);
    const t = setTimeout(async () => {
      try {
        setNameStatus(await verifyUsername({ data: { username: u } }));
      } catch {
        setNameStatus(null);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [username]);

  async function pickAvatar(file: File) {
    if (!isAcceptedImage(file)) {
      toast.error("Please choose a JPG, PNG or WEBP image.");
      return;
    }
    try {
      setUploadPct(5);
      const compressed = await compressImage(file, (p) => setUploadPct(Math.max(5, p * 0.6)));
      setPreview(compressed.dataUrl);
      setUploadPct(70);
      const blob = dataUrlToBlob(compressed.dataUrl);
      const path = `${data!.id}/avatar-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: blob.type, upsert: true });
      if (error) throw error;
      setUploadPct(90);
      const res = await saveProfile({ data: { avatar_path: path } });
      if (!res.ok) throw new Error(res.message);
      await qc.invalidateQueries({ queryKey: ["profile"] });
      setUploadPct(100);
      toast.success("Your profile picture has been updated.");
    } catch {
      toast.error("We couldn't update your picture. Please try again.");
      setPreview(data?.avatar_url ?? null);
    } finally {
      setTimeout(() => setUploadPct(null), 800);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await saveProfile({
        data: {
          display_name: name.trim(),
          ...(username.trim() ? { username: username.trim().toLowerCase() } : {}),
        },
      });
      if (res.ok) {
        await qc.invalidateQueries({ queryKey: ["profile"] });
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("We couldn't save your changes right now. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell title="Personal Information" subtitle="Profile picture, display name and username">
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading your details…</div>
      ) : (
        <div className="space-y-5">
          <Card className="flex flex-col items-center gap-3 text-center">
            <button
              onClick={() => fileRef.current?.click()}
              className="relative h-28 w-28 overflow-hidden rounded-full border border-border bg-muted"
              aria-label="Change profile picture"
            >
              {preview ? (
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <User className="h-10 w-10" />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/60 py-1.5 text-[11px] font-medium text-white">
                <Camera className="h-3.5 w-3.5" /> Change
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) pickAvatar(f);
              }}
            />
            {uploadPct !== null && (
              <div className="w-full max-w-xs">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${uploadPct}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {uploadPct < 100 ? "Uploading your picture…" : "Picture updated"}
                </p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              JPG, PNG or WEBP. Large photos are resized automatically.
            </p>
          </Card>

          <Card className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="display-name">
                Display name
              </label>
              <input
                id="display-name"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                placeholder="How should we call you?"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">Shown across Niza Prime AI. 2–40 characters.</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="username">
                Username
              </label>
              <div className="flex items-center rounded-lg border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
                <span className="text-sm text-muted-foreground">@</span>
                <input
                  id="username"
                  value={username}
                  maxLength={20}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, "").toLowerCase())}
                  placeholder="yourname"
                  className="w-full bg-transparent px-1 py-2 text-sm outline-none"
                />
              </div>
              <p
                className={`mt-1 text-xs ${
                  nameStatus ? (nameStatus.ok ? "text-emerald-500" : "text-destructive") : "text-muted-foreground"
                }`}
              >
                {nameStatus?.message ?? "3–20 lowercase letters, numbers, dots or underscores. Must be unique."}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                value={data?.email ?? ""}
                readOnly
                className="w-full cursor-not-allowed rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Your email comes from your sign-in method and can't be changed here.
              </p>
            </div>

            <button
              onClick={save}
              disabled={saving || (nameStatus ? !nameStatus.ok : false)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
