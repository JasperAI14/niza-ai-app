# Niza Prime AI — Major Update Implementation Plan (revised)

Follows the 13 Golden Rules: fix and extend what exists, never redesign working features.

## Current state (verified)

- Router: `routeRequest` in `src/lib/chat.server.ts` — rules-first CHAT / CODE / IMAGE_GEN / IMAGE_EDIT / VISION / MUSIC_SHORT / MUSIC_SONG, model fallback for ambiguous wording. No clarification step, no web search, no memory input.
- `sendMessage` (`src/lib/chat.functions.ts`) owns the pipeline: limits, watermark (4 free clean images), storage, usage counters.
- Smart Copy: `src/lib/artifact.ts` + `CopyCard.tsx`, triggered by length/format heuristics in `src/lib/intent.ts`.
- Speech-to-text: inline in `NizaApp.tsx`, `SpeechRecognition` with a session token. No waveform, no persistence, no offline queue.
- Music: `generateMusic` / `saveMusic` / `listMusic` / `deleteMusic`, `music_history` table, `MusicCard.tsx`. No music workspace page.
- NizaHub: `novahub.server.ts` (HMAC signing + webhook verification), admin page, webhook route that verifies and logs but does not dispatch events.
- Theme (`theme.ts`), auth page (Google + email + magic link + WebView fallback), action bar, code blocks, share cards, search, long-press all exist in first-pass form.

## 1. Router Knowledge Base

A single server-side knowledge base drives every routing decision, replacing scattered regex checks.

Modes: `CHAT`, `CODE`, `IMAGE_GEN`, `IMAGE_EDIT`, `VISION`, `MUSIC_SHORT`, `MUSIC_SONG`, `WEB_SEARCH`, `CLARIFY`.

Decision shape: `{ mode, prompt, confidence, clarify?: { question, options[] }, aspect?, memoryOps? }`.

Order: deterministic rules → knowledge-base intent match → model classification only when still ambiguous → safe CHAT fallback.

### 1a. Clarification engine
- Triggers on: ambiguous single words ("cat", "sunset", "logo"), incomplete prompts ("make me one", "do it", "again"), conflicting signals (image + music words together), and missing required detail for media.
- Behaviour: one short question plus 2–4 tappable option chips. Never more than one clarification round for the same request; if the user answers vaguely again, pick the safest interpretation and proceed.
- Image-only clarification: for image requests, only ask when the subject or style is genuinely unclear. A clear description generates immediately — never ask for confirmation of an already-complete image prompt. Clarification never consumes image quota.
- Chips render in the message and, when tapped, resend the resolved intent so the user never retypes.

### 1b. Hidden memory
- New `user_memory` table: `user_id`, `key`, `value`, `kind`, `source_message_id`, `updated_at`; RLS owner-only, explicit GRANTs to `authenticated` and `service_role`.
- Retrieval: on every request, a compact capped memory block is injected into the system prompt. Never displayed in chat, never mentioned by the assistant.
- Update rules: store durable facts only (name, preferred language, tone, recurring projects, stated preferences). Overwrite by key, prune stale entries.
- Hard exclusions — never stored, in memory or logs: passwords, API keys, tokens, secrets, OTP codes, card/bank details, ID numbers, addresses, or anything the user marks private. A server-side redaction filter runs before any write, and matching content is dropped silently.
- User control: view and clear memory from Profile → Personal Information.

### 1c. Topic continuation vs switch
- Continuation signals (pronouns, "and", "also", "the other one", follow-up questions) keep full context.
- Switch signals (new named subject with no referential link) drop stale context from the prompt window, keep the thread, and re-derive the title.
- Conservative threshold: when unsure, keep context.

### 1d. Web search routing
- `WEB_SEARCH` for time-sensitive or factual queries: "latest", "today", "now", news, prices, scores, releases, live events, "who is currently".
- Runs server-side; answer is summarised with inline source links rendered under the response. Provider names never surfaced.

### 1e. Smart Copy routing
- The router, not formatting heuristics, decides Smart Copy: activates only for reusable artifacts (code, emails, letters, documents, essays, prompts, structured plans). Ordinary conversation, short answers and explanations never collapse into a card.
- Card title derived from the artifact; download uses the correct extension.

### 1f. Emoji-capable responses
- Responses may use emojis naturally and sparingly where tone fits (greetings, encouragement, lists), and omit them in code, technical, formal or serious contexts. Added to the system prompt style rules, not hardcoded per message.

### 1g. Image aspect ratios
- Explicit ratio support with exact sizes: square 1:1 (1024×1024), portrait 3:4 (896×1152) and 9:16 (768×1344), landscape 4:3 (1152×896) and 16:9 (1344×768).
- The router infers ratio from wording ("wallpaper", "phone background", "banner", "poster", "profile picture") and honours explicit requests ("16:9", "vertical"). Default is 1:1 when nothing indicates otherwise.

### 1h. NizaHub knowledge
- Router and system prompt know what NizaHub is (identity, SSO, subscription and payment platform behind the account), so questions about accounts, subscriptions and sign-in are answered correctly without exposing internal endpoints or secrets.

## 2. Speech-to-text redesign (exact UX)

- Tapping the mic switches the composer into recording mode: the composer lifts above the keyboard area, the normal input is replaced by the recording bar.
- Recording bar: X (cancel, discards), live waveform driven by the mic analyser, elapsed timer, Stop, and Send.
- Stop ends capture and drops the transcript into the composer for review and editing. Send is only available after review — nothing is auto-sent.
- Background persistence: recording continues across brief tab blur/screen-off via keep-alive and auto-restart on `onend`; when the browser forcibly suspends the mic, the bar shows a paused state and auto-resumes on return with no lost text.
- Offline queue: transcript and any pending send are stored locally when the network drops and flushed automatically when connectivity returns.
- Session tokens keep duplicate-word protection already in place.

## 3. Music workflow
- Dedicated Music workspace with history, a player that keeps playing while navigating, save/download/delete and regenerate. Automatic intent detection stays; short vs song tier shown on the card.

## 4. Theme redesign
- Refine the existing token set for contrast and consistency; sweep components for hardcoded colors into tokens. No new theme engine.

## 5. Authentication redesign
- Keep all working providers and the WebView fallback. Polished layout, language selection, clearer error states.

## 6. Response action bars
- Consistent Copy, Like, Dislike, Regenerate, Share across text, image and music, with type-specific extras (Download/Edit on images, Save on music).

## 7. Code blocks and live preview
- Language detection, professional header, copy and download, sandboxed live preview for HTML/CSS/JS, correct mobile wrapping and scroll.

## 8. Sharing system
- One share entry point for messages, images, music and cards; native share where available, branded share-card image fallback.

## 9. Search improvements
- Titles and message content, partial matching, highlighted excerpts, jump-to-message.

## 10. Long-press menus
- AI message: Copy, Select text, Share, Pin, Details. User message: Edit, Copy, Select text, Delete. Same behaviour on touch and right-click.

## 11. NizaHub integration
- Complete webhook event dispatch (identity, SSO, subscription updates) on top of the existing signature verification, reconcile plan state on login, and surface link status in the admin page.

## 12. Verification checklist
Build and typecheck clean; router regression set (chat, code, image, edit, vision, music, ambiguous single word, incomplete prompt, web search); clarification never fires on complete image prompts and never consumes quota; memory write/read/clear plus redaction proven against a password/API-key sample; aspect ratios produce the exact pixel sizes listed; STT on Android Chrome and iOS Safari including blur, resume and offline; music playback across navigation; limits, watermark and premium bypass; auth on all providers including WebView; RLS and grants on `user_memory`; PWA install and offline.

## Technical notes
- Router knowledge base and memory helpers live in `chat.server.ts`; server functions in `chat.functions.ts`. No keys client-side.
- One migration for `user_memory` (RLS + GRANTs).
- Web search executes inside a server function; providers and model names are never exposed to users.
