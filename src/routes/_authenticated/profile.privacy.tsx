import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Card } from "@/components/PageShell";
import { PrivacyBody } from "@/components/LegalDoc";

export const Route = createFileRoute("/_authenticated/profile/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Niza Prime AI" },
      { name: "description", content: "How Niza Prime AI collects, uses and protects your information." },
      { property: "og:title", content: "Privacy Policy — Niza Prime AI" },
      { property: "og:description", content: "How Niza Prime AI collects, uses and protects your information." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <PageShell title="Privacy Policy" subtitle="The full policy, also available publicly at /privacy">
      <Card className="space-y-6">
        <PrivacyBody />
        <p className="text-sm text-muted-foreground">
          Our <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link> are also available.
        </p>
      </Card>
    </PageShell>
  );
}
