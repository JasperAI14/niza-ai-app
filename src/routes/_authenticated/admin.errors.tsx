import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListErrors } from "@/lib/profile.functions";
import { PageShell, Card } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/admin/errors")({
  head: () => ({
    meta: [
      { title: "Error Reports — NovaMind AI" },
      { name: "description", content: "Administrator view of automatic NovaMind AI error reports." },
      { property: "og:title", content: "Error Reports — NovaMind AI" },
      { property: "og:description", content: "Administrator view of automatic NovaMind AI error reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminErrors,
});

function AdminErrors() {
  const load = useServerFn(adminListErrors);
  const { data, isLoading, isError } = useQuery({ queryKey: ["admin-errors"], queryFn: () => load() });

  if (isError) {
    return (
      <PageShell title="Error Reports">
        <Card className="text-sm text-muted-foreground">This area is available to administrators only.</Card>
      </PageShell>
    );
  }

  return (
    <PageShell title="Error Reports" subtitle="Automatic failure reports from the app">
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading reports…</div>
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((e: any) => (
            <Card key={e.id} className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-0.5 uppercase">{e.error_type ?? "error"}</span>
                {e.feature && <span>{e.feature}</span>}
                <span className="ml-auto">{new Date(e.created_at).toLocaleString()}</span>
              </div>
              <p className="break-words text-sm">{e.message}</p>
              {e.device && <p className="truncate text-[11px] text-muted-foreground">{e.device}</p>}
            </Card>
          ))}
          {!data?.length && <p className="py-8 text-center text-sm text-muted-foreground">No error reports.</p>}
        </div>
      )}
    </PageShell>
  );
}
