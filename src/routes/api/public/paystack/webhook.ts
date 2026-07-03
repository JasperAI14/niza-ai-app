import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { activatePremium } from "@/lib/paystack.functions";

export const Route = createFileRoute("/api/public/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY;
        const signature = request.headers.get("x-paystack-signature") || "";
        const raw = await request.text();

        if (!secret) {
          console.error("[paystack.webhook] no secret configured");
          return new Response("misconfigured", { status: 500 });
        }

        // Paystack signs with HMAC SHA512 of raw body using secret key
        const expected = createHmac("sha512", secret).update(raw).digest("hex");
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("invalid signature", { status: 401 });
        }

        let event: any;
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("bad json", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Best-effort audit log
        await supabaseAdmin.from("payment_events").insert({
          event_type: `webhook.${event?.event ?? "unknown"}`,
          reference: event?.data?.reference ?? null,
          amount_kobo: event?.data?.amount ?? null,
          raw: event,
        });

        const resolveUserId = async (): Promise<string | null> => {
          const metaUid = event?.data?.metadata?.user_id as string | undefined;
          if (metaUid) return metaUid;
          const customerCode = event?.data?.customer?.customer_code as string | undefined;
          if (customerCode) {
            const { data } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .eq("paystack_customer_code", customerCode)
              .maybeSingle();
            return data?.id ?? null;
          }
          return null;
        };

        try {
          switch (event?.event) {
            case "charge.success": {
              const userId = await resolveUserId();
              if (!userId) break;
              await activatePremium({
                userId,
                customerCode: event?.data?.customer?.customer_code ?? null,
                subscriptionCode: event?.data?.plan?.plan_code ? event?.data?.plan?.plan_code : null,
                amountKobo: event?.data?.amount ?? null,
                reference: event?.data?.reference ?? "",
                rawEvent: event,
              });
              break;
            }
            case "subscription.create": {
              const userId = await resolveUserId();
              if (!userId) break;
              await supabaseAdmin
                .from("profiles")
                .update({
                  paystack_subscription_code: event?.data?.subscription_code ?? null,
                  paystack_customer_code: event?.data?.customer?.customer_code ?? null,
                })
                .eq("id", userId);
              break;
            }
            case "subscription.disable":
            case "subscription.not_renew":
            case "invoice.payment_failed": {
              const userId = await resolveUserId();
              if (!userId) break;
              await supabaseAdmin
                .from("profiles")
                .update({ plan_status: "canceled" })
                .eq("id", userId);
              break;
            }
          }
        } catch (err) {
          console.error("[paystack.webhook] handler error", err);
          // Always return 200 so Paystack doesn't retry-storm; audit row is stored.
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
