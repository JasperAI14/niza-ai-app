import { createFileRoute } from "@tanstack/react-router";
import { NizaApp } from "@/components/NizaApp";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Niza AI — Chat, Code & Images" },
      { name: "description", content: "Your private AI assistant for chat, coding help, and image generation." },
    ],
  }),
  component: NizaApp,
});
