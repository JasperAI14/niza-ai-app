import { createFileRoute } from "@tanstack/react-router";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are NovaMind AI, a helpful, friendly, and highly capable assistant.
You excel at natural conversation, coding (JavaScript, Python, HTML/CSS, Node.js, and more),
debugging, step-by-step explanations, tutoring, and problem-solving.
Always format code inside fenced markdown code blocks with the correct language tag.
Be concise but thorough. When asked to generate an image, instruct the user to use the
"Generate image:" prefix in their message.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages } = (await request.json()) as { messages: ChatMessage[] };
          if (!Array.isArray(messages)) {
            return new Response("messages required", { status: 400 });
          }

          const key = process.env.GROK_API_KEY;
          if (!key) {
            return Response.json(
              { error: "AI is currently unavailable. Please try again." },
              { status: 500 },
            );
          }

          const upstream = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
                temperature: 0.7,
              }),
            },
          );

          if (!upstream.ok) {
            const errText = await upstream.text();
            console.error("Groq error:", upstream.status, errText);
            return Response.json(
              { error: "AI is currently unavailable. Please try again." },
              { status: 502 },
            );
          }

          const data = (await upstream.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const reply = data.choices?.[0]?.message?.content ?? "";
          return Response.json({ reply });
        } catch (err) {
          console.error("/api/chat error", err);
          return Response.json(
            { error: "AI is currently unavailable. Please try again." },
            { status: 500 },
          );
        }
      },
    },
  },
});
