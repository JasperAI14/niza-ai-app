import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Send, Star } from "lucide-react";
import { listMyReviews, submitReview } from "@/lib/profile.functions";
import { PageShell, Card } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/profile/feedback")({
  head: () => ({
    meta: [
      { title: "Send Feedback — Niza Prime AI" },
      { name: "description", content: "Rate Niza Prime AI and tell our Support Team what you think." },
      { property: "og:title", content: "Send Feedback — Niza Prime AI" },
      { property: "og:description", content: "Rate Niza Prime AI and tell our Support Team what you think." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Feedback,
});

function Feedback() {
  const qc = useQueryClient();
  const send = useServerFn(submitReview);
  const fetchMine = useServerFn(listMyReviews);
  const { data: mine } = useQuery({ queryKey: ["my-reviews"], queryFn: () => fetchMine() });

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return toast.error("Please choose a rating first.");
    if (body.trim().length < 5) return toast.error("Please write a little more about your experience.");
    setBusy(true);
    try {
      const res = await send({ data: { rating, body } });
      if (res.ok) {
        setBody("");
        setRating(0);
        await qc.invalidateQueries({ queryKey: ["my-reviews"] });
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("We couldn't send your feedback right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Send Feedback" subtitle="Your rating helps Niza Prime AI improve">
      <div className="space-y-5">
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium">How would you rate Niza Prime AI?</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    className="p-1"
                  >
                    <Star
                      className={`h-7 w-7 transition ${
                        n <= (hover || rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="review">
                Tell us more
              </label>
              <textarea
                id="review"
                rows={6}
                maxLength={4000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What did you enjoy? What could be better?"
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {busy ? "Sending…" : "Send feedback"}
            </button>
          </form>
        </Card>

        {!!mine?.length && (
          <div className="space-y-3">
            <h2 className="px-1 text-sm font-semibold">Your feedback</h2>
            {mine.map((r: any) => (
              <Card key={r.id} className="space-y-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-4 w-4 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                    />
                  ))}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm">{r.body}</p>
                {r.ai_reply && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                    <div className="mb-1 text-xs font-semibold text-foreground">Niza Prime AI Support</div>
                    {r.ai_reply}
                  </div>
                )}
                {r.admin_reply && (
                  <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                    <div className="mb-1 text-xs font-semibold">Reply from the Support Team</div>
                    {r.admin_reply}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
