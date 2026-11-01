import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { PrivacyBody } from "@/components/LegalDoc";

const TITLE = "Privacy Policy — Niza Prime AI";
const DESC =
  "How Niza Prime AI collects, uses, stores and protects your information, including Google Drive user data, and the choices you have.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://niza-ai-app.lovable.app/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="min-w-0">
            <BrandLogo size={30} withWordmark subtitle="Privacy Policy" />
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms</Link>
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
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <PrivacyBody />
      </main>
    </div>
  );
}
