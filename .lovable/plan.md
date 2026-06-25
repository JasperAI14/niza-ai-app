# Fix Image Generation (text chat untouched)

## Goal
Make image generation reliably work without touching any text/chat code path.

## Diagnosis
Current provider chain in `src/lib/chat.functions.ts > generateImage`:
`lovable → stability → openai → huggingface`

From prior testing:
- **Stability** key present but out of credits → 4xx
- **OpenAI** key present but out of credits/quota → 4xx
- **HuggingFace** inference API returning 530 (service unavailable on free tier for SDXL/FLUX)
- **Lovable AI Gateway** call uses `/v1/images/generations` with `google/gemini-2.5-flash-image` — this is the correct endpoint, but the current request body and response parsing don't match the documented Gateway contract for Gemini models, so it returns empty/errors.

Per Lovable AI Gateway docs:
- Gemini image models require the OpenRouter chat-completions image shape (`messages` + `modalities: ["image","text"]`), NOT `prompt`. Sending `prompt` to a Gemini model returns a chat-completion text with no image data.
- Default recommended model is `openai/gpt-image-2` with `prompt`, `quality:"low"`, `size:"1024x1024"`.

So the Lovable call is silently failing because the body shape is wrong for the chosen model.

## Plan

### 1. Validate keys (read-only check, no code change)
Run a one-off curl from the sandbox against each provider to confirm which keys are alive:
- Lovable Gateway: `POST /v1/images/generations` with `openai/gpt-image-2`, non-streaming, tiny prompt → expect 200 with `data[0].b64_json`.
- OpenAI: `POST /v1/images/generations` `gpt-image-1` → check 200 vs 429/insufficient_quota.
- Stability: `POST /v2beta/stable-image/generate/core` → check credit balance error.
- HuggingFace: `POST` SDXL inference → check 200 vs 530.

Report which keys are healthy. (No file edits in this step.)

### 2. Fix the Lovable provider (only file touched: `src/lib/chat.functions.ts`, only inside image helpers — text helpers untouched)
Rewrite `callLovableImage` to use the **correct, documented** Gateway contract:
- Use model `openai/gpt-image-2` (OpenAI-shape body: `prompt`, `quality:"low"`, `size:"1024x1024"`, `n:1`, non-streaming for simplicity since we upload to storage and return one final image).
- Parse `data[0].b64_json` directly (per docs, Gateway normalizes Gemini → OpenAI shape too).
- On non-2xx, throw with status + first 200 chars of body so logs are actionable.

Add a second Lovable attempt with `google/gemini-2.5-flash-image` using the **Gemini body shape** (`messages` + `modalities`) as a built-in secondary, so we have two free-tier paths through the Gateway.

### 3. Reorder fallback chain
New order (free/working first, paid/credit-limited last):
`lovable-gpt-image-2 → lovable-gemini-flash-image → openai → stability → huggingface`

Each provider wrapped with try/catch and `console.error` including the provider name + status, so future failures are diagnosable from server logs.

### 4. Keep text chat 100% unchanged
- `generateText`, `callGroq`, `callGemini`, `callHuggingFaceText`, `SYSTEM_PROMPT`, `sendMessage` text branch, intent detection — all untouched.
- Only the image helper functions and the `providers` array inside `generateImage` are modified.

### 5. Verify end-to-end
- Call `sendMessage` server fn with a text prompt → confirm text branch still returns assistant text (no regression).
- Call `sendMessage` with "draw a cat" → confirm image branch produces a stored image and signed URL.
- Tail server-function logs to confirm which provider succeeded.

## Files touched
- `src/lib/chat.functions.ts` — image helpers + provider chain only.

## Out of scope
- Text chat code, prompts, models, response handling.
- UI changes (`NovaMindApp.tsx`, `ChatMessage.tsx`) — already wired for images.
- DB schema, RLS, storage bucket — already working.
- Dependency upgrades unless a vulnerability blocks the fix (none expected).
