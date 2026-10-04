// Single source of truth for Premium plans. Amounts are in kobo (₦1 = 100 kobo).
export type PlanTier = "total" | "chat" | "images" | "video";

export const PLANS: Record<PlanTier, { name: string; amountKobo: number; features: string[] }> = {
  total: {
    name: "Total Premium",
    amountKobo: 700000,
    features: ["Everything below", "Higher chat limits", "Images via your Puter account", "Video editing", "No watermark"],
  },
  chat: { name: "Chat Premium", amountKobo: 250000, features: ["Higher chat limits", "Priority responses"] },
  images: { name: "Images Premium", amountKobo: 250000, features: ["Images via your Puter account", "No watermark"] },
  video: { name: "Video Editing Premium", amountKobo: 200000, features: ["Video editing in chat"] },
};

export const PLAN_ORDER: PlanTier[] = ["total", "chat", "images", "video"];

export function formatNaira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`;
}

export function isPlanTier(v: unknown): v is PlanTier {
  return typeof v === "string" && v in PLANS;
}
