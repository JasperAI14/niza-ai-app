# Niza Prime AI — Major Update Implementation Plan

Scope follows the 13 Golden Rules: fix and extend what exists, never redesign working code. Below is what the current build already has, what is missing, and exactly what each feature area needs.

## Current state (verified)

- Router exists in `src/lib/chat.server.ts` (`routeRequest`) with rules-first classification into CHAT / CODE / IMAGE_GEN / IMAGE_EDIT / VISION / MUSIC_SHORT / MUSIC_SONG, plus a model fallback for ambiguous wording. No clarification step, no web-search mode, no memory input.
- `sendMessage` in `src/lib/chat.functions.ts` runs the whole pipeline (limits, watermark, storage, usage). Text history is passed per thread; there is no cross-thread memory and no topic-switch detection.
- Smart Copy lives in `src/lib/artifact.ts` + `CopyCard.tsx`, triggered by heuristics in `src/lib/intent.ts`. Works, but classification is length/format based, not intent based.
- Speech-to-text is inline in `NizaApp.tsx` using `SpeechRecognition` with a session token to stop duplication. No waveform, no persistence across tab blur, no offline queue.
- Music: `generateMusic`, `saveMusic`, `listMusic`, `deleteMusic`, `music_history` table, `MusicCard.tsx`. No dedicated music workspace page.
- Theme: `src/lib/theme.ts` (mode + accent + font scale). Auth page `src/routes/auth.tsx` (300 lines) already supports Google, email, magic link, WebView fallback.
- Action bar, code blocks with live preview, share cards, search, long-press, and NizaHub (`novahub.*`) all exist in first-pass form.

## Planned work

### 1. Intelligent router + clarification engine
- Add `CLARIFY` and `WEB_SEARCH` to `RouteMode`.
- Router returns `{ mode, prompt, confidence, clarifyQuestion? }`. When confidence is low or the request is under-specified (e.g. "make me one"), reply with a single short clarifying question plus 2–3 tappable option chips instead of guessing.
- Chips are rendered in `ChatMessage`; tapping one resends the resolved intent, so the user never types twice.
- Keep the deterministic rule layer first — no extra model call for clearly routed messages.

### 2. Hidden memory
- New `user_memory` table (user_id, key, value, source_message_id, updated_at, RLS owner-only + GRANTs).
- After each exchange, a cheap background extraction stores durable facts (name, preferred language, tone, recurring projects). Never shown in chat; viewable and clearable from Profile → Personal Information.
- Memory is injected into the system prompt as a compact block, capped in size.

### 3. Topic switching
- Detect when a new message is unrelated to the running thread; keep the conversation but drop stale context from the prompt window and re-derive the thread title.
- Threshold tuned to avoid dropping context on follow-ups like "and the other one?".

### 4. Web search routing
- `WEB_SEARCH` mode for time-sensitive or factual queries ("latest", "today", prices, news, "who won").
- Results summarised with inline source links rendered under the answer.

### 5. Smart Copy routing
- Move the decision from formatting heuristics into the router: Smart Copy activates only for reusable artifacts (code, emails, documents, prompts, structured plans), never for conversation.
- Better card titles derived from the artifact itself; correct file extension on download.

### 6. Speech-to-text redesign
- Persistent recording: session survives brief tab blur / screen-off via a keep-alive and auto-restart on `onend` while the user has not stopped.
- Live waveform from the mic analyser, elapsed timer, and a clear stop control.
- Transcript lands in the composer for review before sending — never auto-sends.
- Offline queue: if the network drops mid-session, the transcript and any pending send are stored locally and flushed when connectivity returns.

### 7. Music workflow
- Dedicated Music workspace with history, persistent player (continues while browsing chat), save/download/delete, and regenerate.
- Automatic intent detection stays; short vs song tier surfaced in the card.

### 8. Theme redesign
- Refine the existing token set (dark default, accent choices) for contrast and consistency; no new theme engine. Sweep components for hardcoded colors and move them to tokens.

### 9. Authentication redesign
- Keep all working providers and the WebView fallback. Polish layout, add language selection, clearer error states, and premium visual treatment.

### 10. Response action bars
- Standardise Copy, Like, Dislike, Regenerate, Share across text, image, and music responses, with type-appropriate actions (Download/Edit on images, Save on music) and consistent icons.

### 11. Code blocks and live preview
- Language detection, professional header, copy and download, and sandboxed live preview for HTML/CSS/JS. Fix wrapping and horizontal scroll on mobile.

### 12. Sharing system
- One shared share entry point across messages, images, music, and cards; native share where available, share-card image fallback, consistent branding.

### 13. Search improvements
- Search titles and message content with partial matching, highlighted excerpts, and jump-to-message.

### 14. Long-press menus
- AI message: Copy, Select text, Share, Pin, Details. User message: Edit, Copy, Select text, Delete. Consistent on touch and right-click.

### 15. NizaHub integration
- Verify identity, SSO, and subscription webhooks end to end; surface link status in the admin page and reconcile plan state on login.

### 16. Verification checklist
Build and typecheck clean; router regression set (chat, code, image, edit, vision, music, ambiguous, search); memory write/read/clear; STT on Android Chrome and iOS Safari; music playback across navigation; limits, watermark, and premium bypass; auth on all providers incl. WebView; RLS and grants on new tables; PWA install and offline.

## Technical notes

- New server logic goes in `chat.server.ts` (helpers) and `chat.functions.ts` (server functions); no client-side keys.
- One migration for `user_memory` with RLS policies and explicit GRANTs.
- Web search runs server-side inside a server function; no provider names exposed in the UI.

## Questions before I build

1. Web search: is it available to all users, or Premium only?
2. Hidden memory: automatic for everyone (with a clear/opt-out in Profile), or opt-in?
3. Clarification engine: always ask when unsure, or only for media generation (image/music) where a wrong guess burns quota?
4. Topic switching: keep everything in one thread, or auto-create a new chat when a hard topic change is detected?
5. Music workspace: separate route (`/music`) or a tab inside the current app shell?
6. Background speech: browsers stop the mic when a tab is backgrounded — is auto-resume on return acceptable, or do you want a visible "recording paused" state?
7. Theme: keep the current dark + accent system, or do you want a specific new palette?
8. Should any of this ship in stages, or all in one pass?
