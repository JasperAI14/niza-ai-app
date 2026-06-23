import { createFileRoute } from "@tanstack/react-router";
import { NovaMindApp } from "@/components/NovaMindApp";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "NovaMind AI — Chat, Code & Images" },
      { name: "description", content: "Your private AI assistant for chat, coding help, and image generation." },
    ],
  }),
  component: NovaMindApp,
});
