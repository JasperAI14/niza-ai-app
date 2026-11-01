import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { TermsBody } from "@/components/LegalDoc";

const TITLE = "Terms of Service — Niza Prime AI";
const DESC =
  "The terms that govern your use of Niza Prime AI: accounts, acceptable use, AI-generated content, Premium plans and billing.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://niza-ai-app.lovable.app/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="min-w-0">
            <BrandLogo size={30} withWordmark subtitle="Terms of Service" />
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy</Link>
            <Link
              to="/auth"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Open app
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 pb-20">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <TermsBody />
      </main>
    </div>
  );
}
