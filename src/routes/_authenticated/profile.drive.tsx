import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { HardDrive, Loader2, ExternalLink } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { getDriveStatus, startDriveConnect, completeDriveConnect, disconnectDrive } from "@/lib/drive.functions";
import { connectDriveFlow } from "@/lib/drive-connect";

export const Route = createFileRoute("/_authenticated/profile/drive")({
  head: () => ({
    meta: [
      { title: "Google Drive — Niza Prime AI" },
      { name: "description", content: "Connect your own Google Drive to keep your Niza Prime AI files." },
      { property: "og:title", content: "Google Drive — Niza Prime AI" },
      { property: "og:description", content: "Connect your own Google Drive to keep your Niza Prime AI files." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DrivePage,
});

function DrivePage() {
  const qc = useQueryClient();
  const status = useServerFn(getDriveStatus);
  const start = useServerFn(startDriveConnect);
  const complete = useServerFn(completeDriveConnect);
  const disconnect = useServerFn(disconnectDrive);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["drive-status"], queryFn: () => status() });
  const [busy, setBusy] = useState(false);
  const wasConnected = data?.connected;

  async function onConnect() {
    setBusy(true);
    try {
      await connectDriveFlow(() => start(), (code) => complete({ data: { code } }));
      await qc.invalidateQueries({ queryKey: ["drive-status"] });
      toast.success(wasConnected ? "Reconnected to Google Drive" : "Google Drive connected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't connect Google Drive.");
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect() {
    if (!confirm("Disconnect Google Drive? Files already saved stay in your Drive.")) return;
    setBusy(true);
    try {
      await disconnect();
      await qc.invalidateQueries({ queryKey: ["drive-status"] });
      toast.success("Google Drive disconnected");
    } catch {
      toast.error("Couldn't disconnect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Google Drive" subtitle="Your files, in your own Drive" backTo="/profile">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HardDrive className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="font-semibold">Google Drive</div>
            <div className="truncate text-sm text-muted-foreground">
              {isLoading
                ? "Checking…"
                : error
                  ? "Couldn't check right now"
                  : data?.connected
                    ? `Connected${data.email ? ` as ${data.email}` : ""}`
                    : data?.reconnectRequired
                      ? "Your Google Drive access needs to be renewed."
                      : "Not connected"}
            </div>
          </div>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Niza Prime AI saves your files in a "Niza Prime AI" folder in your own Google Drive. It can only see files it
          creates there — never the rest of your Drive.
        </p>

        {error ? (
          <button onClick={() => refetch()} className="w-full rounded-xl border border-border px-4 py-2.5 text-sm">
            Try again
          </button>
        ) : data?.connected ? (
          <div className="flex flex-col gap-2">
            {data.folderId && (
              <a
                href={`https://drive.google.com/drive/folders/${data.folderId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-accent"
              >
                Open my Niza folder <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              disabled={busy}
              onClick={onDisconnect}
              className="rounded-xl border border-destructive/40 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            disabled={busy || isLoading}
            onClick={onConnect}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {data?.reconnectRequired ? "Reconnect Google Drive" : "Connect Google Drive"}
          </button>
        )}
      </div>
    </PageShell>
  );
}
