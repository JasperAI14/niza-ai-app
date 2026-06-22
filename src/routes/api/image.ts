import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt } = (await request.json()) as { prompt: string };
          if (!prompt || typeof prompt !== "string") {
            return Response.json({ error: "prompt required" }, { status: 400 });
          }

          const key = process.env.STABILITY_API_KEY;
          if (!key) {
            return Response.json(
              { error: "Image service unavailable. Please try again." },
              { status: 500 },
            );
          }

          const form = new FormData();
          form.append("prompt", prompt);
          form.append("output_format", "png");

          const upstream = await fetch(
            "https://api.stability.ai/v2beta/stable-image/generate/core",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${key}`,
                Accept: "image/*",
              },
              body: form,
            },
          );

          if (!upstream.ok) {
            const errText = await upstream.text();
            console.error("Stability error:", upstream.status, errText);
            return Response.json(
              { error: "Image generation failed. Please try again." },
              { status: 502 },
            );
          }

          const buf = await upstream.arrayBuffer();
          const b64 = Buffer.from(buf).toString("base64");
          const dataUrl = `data:image/png;base64,${b64}`;
          return Response.json({ image: dataUrl });
        } catch (err) {
          console.error("/api/image error", err);
          return Response.json(
            { error: "Image generation failed. Please try again." },
            { status: 500 },
          );
        }
      },
    },
  },
});
