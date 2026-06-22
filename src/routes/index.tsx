import { createFileRoute } from "@tanstack/react-router";
import { NovaMindApp } from "@/components/NovaMindApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NovaMind AI — Chat, Code, and Image Generation" },
      {
        name: "description",
        content:
          "NovaMind AI is an advanced assistant for natural chat, coding help, debugging, and AI image generation.",
      },
      { property: "og:title", content: "NovaMind AI" },
      {
        property: "og:description",
        content:
          "An advanced AI assistant for chat, coding, and image generation.",
      },
    ],
  }),
  component: NovaMindApp,
});
