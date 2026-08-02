import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { adminListReviews, adminUpdateReview } from "@/lib/profile.functions";
import { PageShell, Card } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  head: () => ({
    meta: [
      { title: "Reviews Dashboard — NovaMind AI" },
      { name: "description", content: "Administrator view of all NovaMind AI reviews and ratings." },
      { property: "og:title", content: "Reviews Dashboard — NovaMind AI" },
      { property: "og:description", content: "Administrator view of all NovaMind AI reviews and ratings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminReviews,
});

function AdminReviews() {
  const qc = useQueryClient();
  const load = useServerFn(adminListReviews);
  const update = useServerFn(adminUpdateReview);
  const { data, isLoading, isError } = useQuery({ queryKey: ["admin-reviews"], queryFn: () => load() });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "escalated" | "resolved">("all");

  async function act(id: string, patch: any) {
    try {
      await update({ data: { id, ...patch } });
      await qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      toast.success("Updated.");
    } catch {
      toast.error("That action didn't go through. Please try again.");
    }
  }

  if (isError) {
    return (
      <PageShell title="Reviews Dashboard">
        <Card className="text-sm text-muted-foreground">This area is available to administrators only.</Card>
      </PageShell>
    );
  }

  const reviews = (data?.reviews ?? []).filter((r: any) =>
    filter === "all" ? true : r.status === filter,
  );

  return (
    <PageShell title="Reviews Dashboard" subtitle="All user reviews and ratings">
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading reviews…</div>
      ) : (
        <div className="space-y-5">
          <Card className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xl font-semibold">{data?.stats.total ?? 0}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div>
              <div className="text-xl font-semibold">{data?.stats.average ?? 0}</div>
              <div className="text-xs text-muted-foreground">Average</div>
            </div>
            <div>
              <div className="text-xl font-semibold">{data?.stats.escalated ?? 0}</div>
              <div className="text-xs text-muted-foreground">Escalated</div>
            </div>
          </Card>

          <div className="flex gap-1 rounded-lg bg-muted p-1 text-xs">
            {(["all", "escalated", "resolved"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 rounded-md px-2 py-1.5 font-medium capitalize ${
                  filter === f ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {reviews.map((r: any) => (
            <Card key={r.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                    />
                  ))}
                </div>
                <span className="truncate text-xs text-muted-foreground">
                  {r.author?.display_name ?? r.author?.email ?? "User"}
                </span>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase">{r.status}</span>
              </div>
              <p className="text-sm">{r.body}</p>
              {r.ai_reply && <p className="text-xs text-muted-foreground">Auto reply: {r.ai_reply}</p>}
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
                <button onClick={() => act(r.id, { remove: true })} className="rounded-md border border-destructive/40 px-3 py-1.5 text-destructive">
                  Delete
                </button>
              </div>
            </Card>
          ))}
          {!reviews.length && <p className="py-8 text-center text-sm text-muted-foreground">No reviews yet.</p>}
        </div>
      )}
    </PageShell>
  );
}
