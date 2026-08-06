# Niza Prime AI — Detailed Implementation Plan

Written against the project as it exists today. Golden Rules apply throughout: fix what is broken or missing, never redesign working features, never restart finished work, group related changes, verify after each group.

---

## A. What already exists (inspected, do not rebuild)

- `src/lib/chat.server.ts` — provider layer and router. `routeRequest(text, hasImages)` returns one of CHAT / CODE / IMAGE_GEN / IMAGE_EDIT / VISION / MUSIC_SHORT / MUSIC_SONG using regex rules first and a model call only when the wording is ambiguous. Also holds `generateText`, `nizaVisionAnalyze`, `generateImage`, `editImage`, `nizaMusic`, `smartTitle`, `loadProfile`, `loadOrResetUsage`, `isAdminUser`, watermark rule (`FREE_CLEAN_IMAGES = 4`) and the free-tier media delay.
- `src/lib/chat.functions.ts` — all server functions: `sendMessage`, `regenerateText`, `regenerateImage`, `generateMusic`, `saveMusic`, `listMusic`, `deleteMusic`, `searchMessages`, `editMessage`, `togglePin`, `listPinned`, `setFeedback`, thread create/rename/delete, `getMe`, `submitPromo`.
- `src/lib/intent.ts` — image, music, edit and reusable-content regexes.
- `src/lib/artifact.ts` — `looksLikeArtifact`, `parseSegments`, `analyseMessage`, `artifactExtension`.
- `src/components/` — `NizaApp.tsx` (shell, composer, speech, threads), `ChatMessage.tsx`, `CopyCard.tsx`, `CodeBlock.tsx`, `ImageViewer.tsx`, `MusicCard.tsx`, `UpgradeModal.tsx`.
- `src/lib/theme.ts` (mode + accent + font scale), `src/lib/i18n.ts` (12 languages), `src/lib/drafts.ts`, `src/lib/share-card.ts`, `src/lib/filename.ts`, `src/lib/watermark.ts`, `src/lib/niza-knowledge.ts`.
- `src/lib/novahub.server.ts` — signed requests + webhook signature verification; `src/routes/api/public/novahub/webhook.ts` verifies and records but does not act on events.
- Database: profiles, threads, messages, usage, music_history, reviews, support_requests, notifications, user_roles, app_settings, payment_events, message_feedback, pinned_messages. Buckets: avatars, generated-images, generated-audio, support-uploads (all private).

Nothing in this list is replaced. Every item below is an addition to, or a repair of, that code.

---

## 1. Router Knowledge Base

Today the router is a short chain of regexes inside `chat.server.ts`. It will be replaced by a single, readable knowledge base file so every routing rule and every fact about the app lives in one place.

**New file `src/lib/router-kb.ts`** holding, in plain data form:

- For each mode, a list of trigger phrases, strong verbs, subject nouns, and negative phrases that must block the mode. Example: MUSIC blocks on "write the lyrics only" (that is a text request), IMAGE blocks on "describe the image you already sent".
- Confidence scoring: an exact trigger phrase scores high, a lone subject noun scores low. The score decides whether the request runs straight away, goes to the model classifier, or goes to clarification.
- Modes: CHAT, CODE, IMAGE_GEN, IMAGE_EDIT, VISION, MUSIC_SHORT, MUSIC_SONG, WEB_SEARCH, CLARIFY.

**Feature knowledge.** The knowledge base also describes every major part of the application so the router can both route to a feature and explain where it lives: Chat, Images, Image Editing, Music, Smart Copy, Code Blocks, Live Preview, Speech-to-Text, Search, Profile, Authentication, Theme, Settings, NizaHub, Premium, Administrator features and Hidden Memory. Each entry records what the feature does, what it is called in the interface, where it sits in the app, and how a user reaches it.

**Navigation answers.** Questions such as "Where can I generate music?", "Where do I edit images?" or "Where is my profile?" are answered from this same knowledge, using the real structure of the app — the music workspace, the image actions on a generated or uploaded picture, the profile row at the bottom of the chat list. The existing `niza-knowledge.ts` navigation text is folded into this source so there is only one description of the app, and it is kept accurate whenever a screen moves. If a feature does not exist, Niza says so plainly instead of inventing a screen.

**Router order** (in `routeRequest`, same function name and call site, extended signature):
1. Hard rules — an attached image forces IMAGE_EDIT or VISION exactly as today.
2. Knowledge-base match with confidence score.
3. Model classification only when the score sits in the middle band (this keeps cost the same as today).
4. Low score or missing detail → CLARIFY.
5. Anything else → CHAT (or CODE when code wording is present).

The decision object grows to: mode, prompt, confidence, optional clarification, optional aspect ratio, optional memory operations, optional web-search flag. Existing callers keep working because the extra fields are optional.

### 1a. Clarification engine

- **Fires on:** a bare single word or two; an incomplete instruction; two conflicting intents in one message; a media request missing the one detail needed to produce anything sensible; or an uploaded image with no prompt at all.
- **Worked examples:**
  - *"Giraffe"* → "How can I help you with giraffes?" / "What do you need about giraffes?" / "What would you like to know or make about giraffes?"
  - *"HTML"* → asks whether they want HTML written, explained, or reviewed, and for what.
  - *"Python"* → asks what they are building or learning.
  - *"Write Python code"* → asks what the code should actually do.
  - *"Translate this"* → asks which text to translate, and into which language.
  - *"Create music"* → asks what mood, style or subject, and whether it should have vocals.
- **Varied wording.** The question is generated fresh each time and phrased naturally, rotating between openings so the same sentence is never repeated back to back. It stays to one short sentence and is followed by 2–4 tappable chips (for "giraffe": *Picture of a giraffe*, *Facts about giraffes*, *A story about a giraffe*). Tapping a chip resends the resolved request; the user never retypes, and typing a normal reply always works too.
- **Never fires on:** a complete image description, a complete music description, or any normal conversational message. If the user described the picture, it is generated — no confirmation step.
- **One round only.** If the follow-up is still vague, Niza picks the most likely reading, says what it is doing in half a sentence, and proceeds.
- **No cost:** a clarification turn does not consume text or image quota.

### 1b. Uploaded image intelligence

- An image sent with **no prompt** is first checked against the conversation. If it clearly belongs to what is already being discussed, that context is used and the image is handled as a continuation without asking anything.
- If it does not relate to the conversation, Niza analyses only the useful visible content of the picture and offers the obvious next steps (describe, edit, extract text).
- **Private and irrelevant device UI is ignored.** Screenshots must never have their battery percentage, signal or wifi icons, notification icons, clock or status bar, or any other incidental device chrome described or mentioned — unless the user specifically asks about them.
- An image sent **with** a prompt continues to route to IMAGE_EDIT or VISION exactly as it does today.

### 1c. Hidden memory

- **New table `user_memory`**: user_id, key, value, kind, source_message_id, updated_at. Owner-only RLS plus explicit grants (`authenticated`, `service_role`) in the same migration.
- **Retrieval:** before every generation the user's memory rows are compacted into a short block and appended to the system prompt. It is never shown in the chat, never listed back, and Niza never says it remembers something unless asked directly.
- **Stored:** long-term user preferences, conversation style and tone preferences, the projects they are currently working on, workflows they use repeatedly, their preferred language, name, profession, and stated likes and dislikes. Writing is by key, so a changed fact overwrites the old one; stale rows are pruned.
- **Never stored, under any circumstance:** passwords, API keys, tokens, secret or private links, payment and card details, bank information, OTP or verification codes, national ID or passport numbers, health details, home addresses, and anything the user marks private or asks to be forgotten. A redaction filter runs before the write; matching content is dropped silently and never logged.
- **User control:** Profile → Personal Information gains a "What Niza remembers" section listing stored facts, with per-item delete and a Clear all button.

### 1d. Topic continuation vs switching

- Continuation is assumed when the message refers back ("it", "that one", "also", "make it bigger", a follow-up question). Full recent context is kept.
- A switch is detected when a new, unrelated subject appears with no referential link. The older context is dropped from the prompt window so the answer is not polluted, the thread and its history stay intact, and the thread title is re-derived.
- When the signals are mixed, context is kept. Losing context is worse than carrying a little extra.

### 1e. Web search routing

- WEB_SEARCH is chosen for anything time-sensitive or verifiable: news, "latest", "today", "current", prices, exchange rates, scores, release dates, who currently holds a position, anything with a near-past or future year.
- The search runs server-side inside the existing pipeline; results are summarised into a normal answer with a short list of source links below it.
- No provider, engine or model name is ever shown. If search is unavailable the answer falls back to normal chat with an honest note that it may not be current.

### 1f. Smart Copy routing

- The router decides Smart Copy, not the current length heuristics. It activates only for genuinely reusable output: code, emails, letters, cover letters, essays, articles, reports, structured documents, prompts, scripts, plans and lists meant to be reused.
- Ordinary conversation, explanations, answers to questions and short replies stay as plain chat bubbles no matter how long they are.
- The card title describes the artifact ("Cover letter", "Python script", "Marketing plan") rather than a generic label, and the download uses the matching file extension via the existing `artifactExtension`.

### 1g. Emoji behaviour

Niza uses emojis naturally and sparingly where the tone fits — greetings, celebrations, encouragement and friendly conversation. It leaves them out of code, technical documentation, formal or professional writing, and sensitive or serious topics. This becomes a style rule in the system prompt, not a per-message toggle.

### 1h. Image aspect ratios

Supported ratios and exact output sizes:

```text
1:1   square      1024 x 1024   (default)
3:4   portrait     896 x 1152
9:16  tall          768 x 1344
4:3   landscape    1152 x 896
16:9  wide         1344 x 768
```

The router infers the ratio from the request — "wallpaper" and "phone background" give 9:16, "banner", "cover" and "thumbnail" give 16:9, "poster" gives 3:4, "profile picture" and "icon" give 1:1 — and always honours an explicit request such as "16:9", "vertical" or "square". In addition, the image generation interface gets a small visible ratio picker so users can choose any of the five ratios directly before generating; an explicit pick always wins over inference. The chosen ratio is passed through `generateImage` and recorded with the message so regenerate keeps the same shape.

### 1i. NizaHub knowledge

Niza understands NizaHub only from the user's point of view: it is the account, sign-in, subscription and payment platform behind a Niza Prime AI account. Questions about signing in, account identity, subscription state or payments are answered correctly and pointed at the right screen. Internal architecture, developer documentation, infrastructure, endpoints and secrets are never described or referenced.

---

## 2. Speech-to-text redesign (exact behaviour)

Current speech code in `NizaApp.tsx` is a plain start/stop with a session token. It becomes a dedicated recording experience, extracted into `src/components/VoiceRecorder.tsx` plus a `useVoiceRecorder` hook.

**Layout while recording.** The message input box stays visible at the top and moves upward to make room. Directly beneath it sits the recording bar containing, left to right: a **Cancel (X)** button, a **live animated waveform**, a **Stop** button and a **Send** button. An elapsed timer runs alongside the waveform.

**Behaviour.**
1. Tapping the mic lifts the composer and shows the recording bar.
2. The waveform animates live from the real microphone level.
3. **Stop** ends capture and converts the speech to text; the text appears inside the message input for review and editing. Nothing is ever sent automatically.
4. **Send** sends the text in the input.
5. **Cancel (X)** discards the recording and everything captured in it.
6. **Background persistence:** recording survives the screen dimming, the tab losing focus and brief app switches, as far as the platform allows. The recogniser restarts automatically when the browser ends the session early, with the session token preserving what was already transcribed so no words are duplicated or lost. Where the browser hard-suspends the microphone, the bar shows a paused state and resumes on return.
7. **Offline queue:** if the network drops, the transcript is kept locally, the bar shows an offline indicator, and any message the user pressed Send on is queued and delivered automatically as soon as connectivity returns.
8. **Auto-resume:** returning to the app with an unfinished recording restores the bar and the text captured so far rather than starting over.
9. Existing duplicate-word protection is kept exactly as it is.

---

## 3. Music workflow

- A dedicated Music workspace route listing generated tracks from `music_history`, with play, pause, seek, save, download, share, regenerate and delete.
- The player keeps playing while the user navigates between chat and music.
- Automatic music intent detection in chat stays; the card shows whether the piece is a short instrumental or a full song, along with the prompt and duration.
- Generation shows an animated in-progress state rather than a frozen bubble.

## 4. Theme

- Users can change the accent colour from Settings, choosing from the accents already defined in `theme.ts`.
- Dark and light mode is a separate, independent choice — changing the accent never changes the mode, and changing the mode never resets the accent. Both persist across sessions.
- Every screen updates consistently and immediately: chat, composer, music, profile, admin, auth, dialogs and share cards all read from the same tokens. Components still holding hardcoded colours are swept into tokens.
- Contrast is checked in both modes for every accent. No new theme engine, no change to the stored preference key.

## 5. Authentication

Keep every working provider and the in-app-browser fallback — the architecture does not change. The experience is raised to feel premium: a cleaner layout with stronger visual hierarchy, refined typography and spacing, smooth entrance and transition animations, polished button and field states, clear loading and error feedback, visible language selection, and a smoother path into Premium.

## 6. Response action bar

One consistent bar under every response: Copy, Like, Dislike, Regenerate, Share — plus Download and Edit on images, and Save on music. Like and Dislike persist through the existing feedback function and show their selected state.

## 7. Code blocks and live preview

Language detection with a professional header (language label, copy, download, and preview where relevant), correct wrapping and horizontal scroll on mobile, and a sandboxed live preview for HTML, CSS and JavaScript that can be expanded to full screen. Preview is only offered for languages that can actually render.

## 8. Sharing

One share entry point used by messages, images, music and copy cards, with the same icon and animation everywhere. It uses the device share sheet where available and falls back to the branded share-card image already implemented in `share-card.ts`.

## 9. Search

Search across thread titles and message content with partial matching, highlighted excerpts in the results, and tapping a result jumping to that exact message in the thread.

## 10. Long-press menus

On an AI message: Copy, Select text, Share, Pin, Details. On a user message: Edit, Copy, Select text, Delete. Identical behaviour for long-press on touch and right-click on desktop, with the existing chat-list long-press-to-delete untouched.

## 11. NizaHub integration

Build on the existing signed-request and signature-verification code: handle the incoming event types (identity update, sign-in, subscription created, changed and cancelled), apply them to the user's plan state, reconcile plan on login so a subscription bought elsewhere is honoured immediately, and show link and last-event status on the admin page. Nothing about the integration's internals is ever surfaced to users.

---

## 12. Verification checklist

- Build and typecheck clean.
- Router regression set: plain chat, code request, clear image request, image edit with attachment, vision question, short music, full song, bare single word, incomplete instruction, conflicting intent, and a time-sensitive question.
- Navigation questions ("where do I edit images?", "where is my profile?", "where can I generate music?") return the real steps.
- Clarification fires on "Giraffe", "HTML", "Write Python code", "Translate this" and "Create music"; never on a complete image prompt; never twice for the same request; never consumes quota; wording varies between turns.
- An image uploaded with no prompt uses conversation context when related, and otherwise analyses only useful content — a screenshot's battery, clock, status bar and notification icons are never mentioned.
- Memory: a fact is stored, retrieved on the next turn, overwritten when changed, deleted individually and cleared entirely from Profile. A message containing a password and an API key leaves no stored row and no log entry.
- Aspect ratios produce exactly the pixel sizes listed, the picker overrides inference, and regenerate keeps the same ratio.
- Speech-to-text tested on Android Chrome and iOS Safari: composer lifts, waveform animates, Stop fills the input, Send sends, Cancel discards, app switch resumes, offline send delivers on reconnect.
- Theme: accent change and mode change are independent, persist, and apply across every screen.
- Music playback continues across navigation; save, download and delete all work.
- Limits, the four free clean images, watermarking, and premium and admin bypasses all still behave as before.
- Auth works on every provider including inside an in-app browser.
- `user_memory` has RLS and grants; no new table is readable by another user.
- PWA still installs and works offline.

## Technical notes

- New: `src/lib/router-kb.ts`, `src/lib/memory.server.ts`, `src/components/VoiceRecorder.tsx`, a music workspace route, one migration for `user_memory`.
- Edited: `chat.server.ts` (router, ratios, web search, memory injection), `chat.functions.ts` (clarify path, memory write, ratio passthrough), `NizaApp.tsx`, `ChatMessage.tsx`, `CopyCard.tsx`, `CodeBlock.tsx`, `ImageViewer.tsx`, `MusicCard.tsx`, `niza-knowledge.ts`, `theme.ts` consumers, the auth page and the NizaHub webhook route.
- All keys stay server-side; no provider, model or internal system name is ever exposed to a user.
