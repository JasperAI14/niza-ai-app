import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Card } from "@/components/PageShell";
import { Bot, Code2, ImageIcon, Music, Sparkles, Wand2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile/about")({
  head: () => ({
    meta: [
      { title: "About NovaMind AI" },
      {
        name: "description",
        content:
          "NovaMind AI is an all-in-one AI assistant for conversation, coding, images, editing and music, created by Paschal Onah Soromtochukwu (Jasper AI).",
      },
      { property: "og:title", content: "About NovaMind AI" },
      {
        property: "og:description",
        content: "An all-in-one AI assistant for conversation, coding, images, editing and music.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

const FEATURES = [
  { icon: Bot, title: "Natural conversation", text: "Ask anything and get clear, thoughtful answers." },
  { icon: Code2, title: "Coding help", text: "Write, explain, debug and review code in any language." },
  { icon: ImageIcon, title: "Image generation", text: "Describe a picture and NovaMind AI creates it." },
  { icon: Wand2, title: "Image understanding and editing", text: "Upload a picture to analyse or change it." },
  { icon: Music, title: "Music generation", text: "Create short pieces and full songs from a description." },
  { icon: Sparkles, title: "Everyday productivity", text: "Plan, summarise, draft and research faster." },
];

function About() {
  return (
    <PageShell title="About NovaMind AI" subtitle="Your all-in-one AI assistant">
      <div className="space-y-5">
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
              N
            </span>
            <div>
              <h2 className="text-lg font-semibold">NovaMind AI</h2>
              <p className="text-xs text-muted-foreground">Intelligence, creativity and productivity in one app</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            NovaMind AI brings conversation, coding help, image creation, image editing and music generation
            together in a single assistant. It is built to feel simple: describe what you need in your own words
            and NovaMind AI works out the rest — no commands to memorise.
          </p>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold">What you can do</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-3 rounded-xl border border-border p-3">
                <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <div className="text-sm font-medium">{f.title}</div>
                  <div className="text-xs text-muted-foreground">{f.text}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-2">
          <h2 className="text-sm font-semibold">Created by</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            NovaMind AI was created and is actively developed by{" "}
            <span className="font-medium text-foreground">Paschal Onah Soromtochukwu</span>, professionally known
            as <span className="font-medium text-foreground">Jasper AI</span>. The app is continuously improved
            with new capabilities, better intelligence and regular updates.
          </p>
        </Card>

        <Card className="space-y-2">
          <h2 className="text-sm font-semibold">Support and feedback</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If something is not working, open Profile then Contact Support. To share your experience, open Profile
            then Send Feedback — our Support Team reads everything that comes in.
          </p>
        </Card>
      </div>
    </PageShell>
  );
}
