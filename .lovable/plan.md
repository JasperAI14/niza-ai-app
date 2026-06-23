# NovaMind AI — Full System Plan

## 1. Backend (Lovable Cloud)
Enable Cloud, then create these tables (all RLS-locked to `auth.uid()`):

- **profiles** — `id` (=auth.users.id), `email`, `plan` ('free'|'premium'), `promo_used` bool, `created_at`. Auto-created via trigger on signup.
- **threads** — `id`, `user_id`, `title`, `created_at`, `updated_at`.
- **messages** — `id`, `thread_id`, `user_id`, `role` ('user'|'assistant'), `content`, `image_url` nullable, `created_at`.
- **usage** — `user_id` PK, `text_count`, `image_count`, `text_window_start`, `image_window_start`. Counts increment per call; reset logic in server fn.

Storage bucket `generated-images` (private), path `{user_id}/{uuid}.png`.

## 2. Auth
- Google OAuth via `lovable.auth.signInWithOAuth("google")`.
- `/auth` page with Google button + optional "Promo Code" field (shown only when `profiles.promo_used=false`).
- Submit promo: server fn validates code === "JASPER AI" (case-insensitive), sets `plan='premium'`, `promo_used=true`. Invalid/empty sets `promo_used=true`, stays free.
- Routes restructured: `/auth` public, everything else under `_authenticated/`.

## 3. Secrets
Add via secure form: `GEMINI_API_KEY`, `HUGGINGFACE_API_KEY` (text fallback + image backup — single key unless user provides two). Reuse existing `GROK_API_KEY` (Groq) and `STABILITY_API_KEY`.

## 4. Server functions (all `requireSupabaseAuth`)
- `sendMessage({ threadId, content })`:
  1. Load usage row; if window expired (text: 2h fallback timer; image: 5h), reset counter.
  2. Detect intent: regex on verbs like "draw|paint|generate.*image|picture of|create.*image|imagine|illustration|logo" → image path.
  3. Enforce limit (free 40 text/10 img; premium 200 text/40 img); 429 if over.
  4. Text: try Groq `llama-3.3-70b-versatile` → Gemini `gemini-2.0-flash` → HF inference. Silent fallback.
  5. Image: Stability core → HF `stabilityai/stable-diffusion-xl-base-1.0`. Upload to storage, store signed URL.
  6. Insert user+assistant messages, increment usage, return reply.
- `listThreads`, `getThread(id)`, `deleteThread(id)`, `renameThread`.
- `getProfile`, `submitPromo({code})`, `getUsage` (live counters).

## 5. UI
- **Sidebar**: threads list, new chat, plan badge, usage bars (Text X/limit, Images X/limit) with color thresholds (70% amber, 90% red, 100% blocked). "AI Video — Coming soon" disabled item for premium only.
- **Chat**: user messages right-aligned (primary bubble), AI left-aligned with avatar. Markdown + code highlighting (already wired). Inline images with download.
- **Soft/strong toasts** at 70%/90%; input disabled with message at 100%.
- Mobile responsive sheet sidebar.

## 6. Hydration fix
Initial state must match SSR. Move localStorage reads into `useEffect` (or rely entirely on server data via Cloud — preferred, eliminates the issue).

## 7. Out of scope (this iteration)
- Actual video generation (button stub only).
- Sharing/export.

After plan approval I'll: enable Cloud → add Gemini+HF secrets via secure form → run migration → write server fns + UI.
