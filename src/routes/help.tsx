import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { FAQS, TUTORIAL_STEPS } from "@/lib/docs-content";

const TITLE = "Niza Prime AI Help — FAQ, Tutorial & Support";
const DESC =
  "Answers to common Niza Prime AI questions, a walkthrough of the app, and how to reach support.";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://niza-ai-app.lovable.app/help" }],
  }),
  component: HelpPage,
});

function HelpPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="min-w-0">
            <BrandLogo size={30} withWordmark subtitle="Help" />
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/docs" className="text-muted-foreground hover:text-foreground">
              Docs
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
        <h1 className="text-3xl font-bold tracking-tight">Help centre</h1>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Quick tutorial</h2>
          <ol className="mt-3 space-y-3">
            {TUTORIAL_STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-medium">
                  {i + 1}. {s.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Frequently asked questions</h2>
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
            {FAQS.map((f) => (
              <li key={f.q} className="px-4 py-3">
                <p className="text-sm font-medium">{f.q}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.a}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Still need help?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in and use Contact Support from your profile — our team replies in-app.
          </p>
          <Link
            to="/profile/support"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Contact support
          </Link>
        </section>
      </main>
    </div>
  );
}
