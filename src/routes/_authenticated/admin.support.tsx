import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminListSupport, adminUpdateSupport } from "@/lib/profile.functions";
import { PageShell, Card } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/admin/support")({
  head: () => ({
    meta: [
      { title: "Support Dashboard — Niza AI" },
      { name: "description", content: "Administrator view of Niza AI support requests." },
      { property: "og:title", content: "Support Dashboard — Niza AI" },
      { property: "og:description", content: "Administrator view of Niza AI support requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminSupport,
});

function AdminSupport() {
  const qc = useQueryClient();
  const load = useServerFn(adminListSupport);
  const update = useServerFn(adminUpdateSupport);
  const { data, isLoading, isError } = useQuery({ queryKey: ["admin-support"], queryFn: () => load() });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function act(id: string, patch: any) {
    try {
      await update({ data: { id, ...patch } });
      await qc.invalidateQueries({ queryKey: ["admin-support"] });
      toast.success("Updated.");
    } catch {
      toast.error("That action didn't go through. Please try again.");
    }
  }

  if (isError) {
    return (
      <PageShell title="Support Dashboard">
        <Card className="text-sm text-muted-foreground">This area is available to administrators only.</Card>
      </PageShell>
    );
  }

  return (
    <PageShell title="Support Dashboard" subtitle="Requests from users">
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading requests…</div>
      ) : (
        <div className="space-y-4">
          {(data ?? []).map((r: any) => (
            <Card key={r.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{r.subject}</span>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase">{r.status}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {r.author?.display_name ?? r.author?.email ?? "User"} ·{" "}
                {new Date(r.created_at).toLocaleString()}
              </div>
              <p className="whitespace-pre-wrap text-sm">{r.message}</p>
              <textarea
                rows={2}
                value={drafts[r.id] ?? r.admin_reply ?? ""}
                onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })}
                placeholder="Reply to this user…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => act(r.id, { admin_reply: drafts[r.id] ?? "" })}
                  className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground"
                >
                  Send reply
                </button>
                <button onClick={() => act(r.id, { status: "resolved" })} className="rounded-md border border-border px-3 py-1.5">
                  Mark resolved
                </button>
                <button onClick={() => act(r.id, { archived: true })} className="rounded-md border border-border px-3 py-1.5">
                  Archive
                </button>
              </div>
            </Card>
          ))}
          {!data?.length && <p className="py-8 text-center text-sm text-muted-foreground">No support requests yet.</p>}
        </div>
      )}
    </PageShell>
  );
}
