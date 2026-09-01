import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { DOC_SECTIONS, PRODUCT_SUMMARY, PUBLIC_MODELS } from "@/lib/docs-content";

const TITLE = "Niza Prime AI Documentation — Chat, Images, Search & Video Editing";
const DESC =
  "How Niza Prime AI works: conversation, image generation and editing, live web, image and video search, documents, code with live preview, and in-chat video editing.";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://niza-ai-app.lovable.app/docs" }],
  }),
  component: DocsPage,
});

function DocsPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="min-w-0">
            <BrandLogo size={30} withWordmark subtitle="Documentation" />
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/help" className="text-muted-foreground hover:text-foreground">
              Help
            </Link>
            <Link
              to="/auth"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Open app
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 pb-20">
        <h1 className="text-3xl font-bold tracking-tight">Niza Prime AI documentation</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{PRODUCT_SUMMARY}</p>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">What powers each capability</h2>
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
            {PUBLIC_MODELS.map((m) => (
              <li key={m.name} className="px-4 py-3">
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-sm text-muted-foreground">{m.what}</p>
              </li>
            ))}
          </ul>
        </section>

        {DOC_SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="mt-8">
            <h2 className="text-lg font-semibold">{s.title}</h2>
            {s.body.map((p) => (
              <p key={p} className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
            {s.bullets && (
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section className="mt-10 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Getting started</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create an account, then send your first message. A short tutorial appears on your first
            visit and stays available from Help.
          </p>
          <Link
            to="/auth"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Create your account
          </Link>
        </section>
      </main>
    </div>
  );
}
