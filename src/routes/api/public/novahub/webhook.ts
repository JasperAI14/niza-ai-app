import { createFileRoute } from "@tanstack/react-router";

// Nova Hub -> this app webhook receiver.
// Every notification is verified with the configured Webhook Secret before
// being trusted. Concrete event handling is added once Nova Hub finalizes
// its event schema; for now we verify + log so nothing gets acted on until
// it is proven authentic.
export const Route = createFileRoute("/api/public/novahub/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature =
          request.headers.get("x-nova-signature") ??
          request.headers.get("x-webhook-signature");
        const { verifyNovaHubWebhook } = await import("@/lib/novahub.server");
        const ok = await verifyNovaHubWebhook(raw, signature);
        if (!ok) return new Response("Invalid signature", { status: 401 });

        // Verified. Parse and record; event dispatch wires in once Nova Hub
        // publishes its event names.
        let payload: unknown = null;
        try {
          payload = raw ? JSON.parse(raw) : null;
        } catch {
          payload = raw;
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("payment_events").insert({
            event_type: "novahub.webhook",
            raw: payload as any,
          });
        } catch {
          // Non-fatal: acknowledge so Nova Hub does not retry storms.
        }
        return Response.json({ received: true });
      },
    },
  },
});
