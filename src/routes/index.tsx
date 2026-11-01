import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "Niza Prime AI — Your AI Assistant for Chat, Images & Live Search";
const DESC =
  "Niza Prime AI is one private AI workspace: chat, image generation and editing, live web search with sources, real image and video discovery, code help with live preview, and in-chat video editing.";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/chat" });
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://niza-ai-app.lovable.app/" }],
  }),
  component: Landing,
});

const FEATURES = [
  { title: "Natural conversation", body: "Ask anything — explanations, advice, tutoring, writing help. No commands to memorise." },
  { title: "Image generation & editing", body: "Describe a picture to create it, or upload one to restyle, retouch and change it." },
  { title: "Live search with sources", body: "Questions about current events, prices and news are answered from live results, with links to the sources." },
  { title: "Real images & videos", body: "Find real photos of things, and watch videos — including live streams — right inside the app." },
  { title: "Code that runs", body: "Code answers arrive highlighted, with copy, download and a live preview for web code." },
  { title: "Video editing in chat", body: "Upload a video and describe the change — trimming, rotating, muting, resizing — in plain language." },
  { title: "Your files, understood", body: "Attach documents, code files or pictures and ask questions about their contents." },
  { title: "What's trending", body: "Discover trending music, dances and topics from public trend feeds, with sources." },
];

function Landing() {
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled && data.user) window.location.replace("/chat");
      else if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <BrandLogo size={30} withWordmark />
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/docs" className="text-muted-foreground hover:text-foreground">Docs</Link>
            <Link to="/help" className="hidden text-muted-foreground hover:text-foreground sm:inline">Help</Link>
            <Link
              to="/auth"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-20">
        <section className="py-14 text-center sm:py-20">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            One AI workspace for chat, images and live search
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Niza Prime AI answers your questions, creates and edits pictures, searches the live web with
            sources, finds real photos and videos, writes and previews code, and edits your videos — all in a
            single private conversation.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {checking ? "Get started" : "Get started — it's free"}
            </Link>
            <Link
              to="/docs"
              className="rounded-xl border border-border bg-background px-6 py-3 text-sm font-semibold hover:bg-accent"
            >
              Read the docs
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-14 rounded-2xl border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-semibold">Ready to try it?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Create a free account and start chatting right away. Premium plans raise your limits and unlock
            everything — you can upgrade any time from inside the app.
          </p>
          <Link
            to="/auth"
            className="mt-5 inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Create your free account
          </Link>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
          <BrandLogo size={24} withWordmark />
          <nav className="flex flex-wrap items-center gap-4">
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
            <Link to="/docs" className="hover:text-foreground">Docs</Link>
            <Link to="/help" className="hover:text-foreground">Help</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
