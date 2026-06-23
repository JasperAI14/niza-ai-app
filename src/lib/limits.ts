export const LIMITS = {
  free: { text: 40, image: 10 },
  premium: { text: 200, image: 40 },
} as const;

export const TEXT_RESET_MS = 2 * 60 * 60 * 1000; // 2h fallback
export const IMAGE_RESET_MS = 5 * 60 * 60 * 1000; // 5h

export const PROMO_CODE = "JASPER AI";

export type Plan = "free" | "premium";

export function planLimits(plan: Plan) {
  return LIMITS[plan];
}
