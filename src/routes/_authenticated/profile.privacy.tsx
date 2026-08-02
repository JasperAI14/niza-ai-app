import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Card } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/profile/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — NovaMind AI" },
      { name: "description", content: "How NovaMind AI collects, uses and protects your information." },
      { property: "og:title", content: "Privacy Policy — NovaMind AI" },
      { property: "og:description", content: "How NovaMind AI collects, uses and protects your information." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function Privacy() {
  return (
    <PageShell title="Privacy Policy" subtitle="Last updated: February 2026">
      <Card className="space-y-6">
        <Section title="Information we collect">
          <p>
            When you use NovaMind AI we collect the email address linked to your sign-in method, the profile
            details you choose to add (display name, username and profile picture), and the content of your
            conversations, including the pictures, documents and audio you create or upload.
          </p>
        </Section>
        <Section title="How your information is used">
          <p>
            Your information is used to sign you in, keep your conversations available on your account, apply your
            plan and usage allowance, answer your questions, and improve the reliability of NovaMind AI. Support
            messages and feedback are used only to respond to you and to fix problems.
          </p>
        </Section>
        <Section title="Your conversations">
          <p>
            Conversations belong to your account. Only you can open them while signed in, and you can delete any
            chat at any time by pressing and holding it in the chat list. Deleting a chat removes its messages and
            the pictures or audio created in it.
          </p>
        </Section>
        <Section title="Security">
          <p>
            Your account is protected by your sign-in method, and your data is separated per account so that no
            other user can read it. Files you create are kept in private storage and are opened through short-lived
            secure links.
          </p>
        </Section>
        <Section title="Sharing">
          <p>
            NovaMind AI does not sell your information and does not share your conversations with other users.
            Information is shared only where it is needed to run the service, such as secure payment handling for
            Premium subscriptions, or where the law requires it.
          </p>
        </Section>
        <Section title="Your choices">
          <p>
            You can update your profile at any time from Personal Information, delete individual chats, or contact
            our Support Team to request removal of your account and its content.
          </p>
        </Section>
        <Section title="Children">
          <p>NovaMind AI is intended for people aged 13 and above.</p>
        </Section>
        <Section title="Changes to this policy">
          <p>
            If this policy changes we will update this page and the date above. Continuing to use NovaMind AI after
            a change means you accept the updated policy.
          </p>
        </Section>
        <Section title="Contact">
          <p>
            Questions about privacy can be sent from Profile then Contact Support, and our Support Team will
            respond as soon as possible.
          </p>
        </Section>
      </Card>
    </PageShell>
  );
}
