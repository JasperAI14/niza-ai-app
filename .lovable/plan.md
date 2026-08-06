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

Today the router is a short chain of regexes inside `chat.server.ts`. It will be replaced by a single, readable knowledge base file so every routing rule lives in one place and can be extended without touching the pipeline.

**New file `src/lib/router-kb.ts`** holding, in plain data form:

- For each mode, a list of trigger phrases, strong verbs, subject nouns, and negative phrases that must block the mode. Example: MUSIC blocks on "write the lyrics only" (that is a text request), IMAGE blocks on "describe the image you already sent".
- Confidence scoring: an exact trigger phrase scores high, a lone subject noun scores low. The score decides whether the request runs straight away, goes to the model classifier, or goes to clarification.
- Modes: CHAT, CODE, IMAGE_GEN, IMAGE_EDIT, VISION, MUSIC_SHORT, MUSIC_SONG, WEB_SEARCH, CLARIFY.

**Router order** (in `routeRequest`, same function name and call site, extended signature):
1. Hard rules — an attached image forces IMAGE_EDIT or VISION exactly as today.
2. Knowledge-base match with confidence score.
3. Model classification only when the score sits in the middle band (this keeps cost the same as today).
4. Low score or missing detail → CLARIFY.
5. Anything else → CHAT (or CODE when code wording is present).

The decision object grows to: mode, prompt, confidence, optional clarification, optional aspect ratio, optional memory operations, optional web-search flag. Existing callers keep working because the extra fields are optional.

### 1a. Clarification engine

- **Fires on:** a bare single word or two ("cat", "sunset", "logo", "song"); an incomplete instruction ("make me one", "do it", "again", "another"); two conflicting intents in one message ("make a song poster"); or a media request missing the one detail needed to produce anything sensible.
- **Never fires on:** a complete image description, a complete music description, or any normal conversational message. If the user described the picture, it is generated — no confirmation step.
- **Wording:** the question is generated fresh each time and phrased naturally, so it never reads like a template. It stays to one short sentence and is followed by 2–4 tappable chips (for a bare "cat": *Picture of a cat*, *Facts about cats*, *A story about a cat*). Tapping a chip resends the resolved request; the user never retypes.
- **One round only.** If the follow-up is still vague, Niza picks the most likely reading, says what it is doing in half a sentence, and proceeds.
- **No cost:** a clarification turn does not consume text or image quota and does not count against limits.

### 1b. Hidden memory

- **New table `user_memory`**: user_id, key, value, kind, source_message_id, updated_at. Owner-only RLS plus explicit grants (`authenticated`, `service_role`) in the same migration.
- **Retrieval:** before every generation the user's memory rows are compacted into a short block and appended to the system prompt. It is never shown in the chat, never listed back, and Niza never says it remembers something unless asked directly.
- **Update:** after a reply, durable facts only are written — the user's name, preferred language, tone preference, profession, recurring projects, stated likes and dislikes. Writing is by key, so a changed fact overwrites the old one; stale rows are pruned.
- **Never stored, under any circumstance:** passwords, API keys, tokens, secrets, OTP or verification codes, card and bank details, national ID or passport numbers, home addresses, health details, and anything the user says is private or asks to be forgotten. A redaction filter runs before the write; matching content is dropped silently and never logged.
- **User control:** Profile → Personal Information gains a "What Niza remembers" section listing stored facts with a Clear all button.

### 1c. Topic continuation vs switching

- Continuation is assumed when the message refers back ("it", "that one", "also", "and", "make it bigger", a follow-up question). Full recent context is kept.
- A switch is detected when a new, unrelated subject appears with no referential link. The older context is dropped from the prompt window so the answer is not polluted, the thread and its history stay intact, and the thread title is re-derived.
- When the signals are mixed, context is kept. Losing context is worse than carrying a little extra.

### 1d. Web search routing

- WEB_SEARCH is chosen for anything time-sensitive or verifiable: news, "latest", "today", "current", prices, exchange rates, scores, release dates, who currently holds a position, anything with a year in the near past or future.
- The search runs server-side inside the existing pipeline; results are summarised into a normal answer with a short list of source links below it.
- No provider, engine or model name is ever shown. If search is unavailable the answer falls back to normal chat with an honest note that it may not be current.

### 1e. Smart Copy routing

- The router decides Smart Copy, not the current length heuristics. It activates only for genuinely reusable output: code, emails, letters, cover letters, essays, articles, reports, structured documents, prompts, scripts, plans and lists meant to be reused.
- Ordinary conversation, explanations, answers to questions and short replies stay as plain chat bubbles no matter how long they are.
- The card title describes the artifact ("Cover letter", "Python script", "Marketing plan") rather than a generic label, and the download uses the matching file extension via the existing `artifactExtension`.

### 1f. Emoji-capable responses

Niza may use emojis naturally and sparingly where the tone fits — greetings, encouragement, light lists, celebratory replies — and leaves them out of code, technical explanations, formal writing and serious or sensitive topics. This becomes a style rule in the system prompt, not a per-message toggle.

### 1g. Image aspect ratios

Supported ratios and exact output sizes:

```text
1:1   square      1024 x 1024   (default)
3:4   portrait     896 x 1152
9:16  tall          768 x 1344
4:3   landscape    1152 x 896
16:9  wide         1344 x 768
```

The router infers the ratio from the request — "wallpaper" and "phone background" give 9:16, "banner", "cover" and "thumbnail" give 16:9, "poster" gives 3:4, "profile picture" and "icon" give 1:1 — and always honours an explicit request such as "16:9", "vertical" or "square". The ratio is passed through `generateImage` to the provider and recorded with the message so regenerate keeps the same shape.

### 1h. NizaHub knowledge

The system prompt and knowledge file learn what NizaHub is: the identity, single sign-on, subscription and payment platform behind a Niza Prime AI account. Questions about signing in, account identity, subscription state or payments are answered correctly and pointed at the right screen, without ever naming internal endpoints, providers or secrets.

---

## 2. Speech-to-text redesign (exact behaviour)

Current speech code in `NizaApp.tsx` is a plain start/stop with a session token. It becomes a dedicated recording experience, extracted into `src/components/VoiceRecorder.tsx` plus a `useVoiceRecorder` hook.

1. Tapping the mic switches the composer into recording mode: the composer lifts clear of the keyboard area and the text field is replaced by the recording bar.
2. The recording bar contains, left to right: an **X** that cancels and discards everything; a **live waveform** driven by the real microphone level; an **elapsed timer** counting up; **Stop**; and **Send**.
3. **Stop** ends capture and drops the finished transcript into the composer for review and editing. Nothing is ever sent automatically — the user reads it, edits it, and presses Send.
4. **Background persistence:** recording survives the screen dimming, the tab losing focus and brief app switches. The recogniser is restarted automatically when the browser ends the session early, with the session token preserving what was already transcribed so no words are duplicated or lost. When the browser hard-suspends the microphone, the bar shows a paused state and resumes automatically on return.
5. **Offline queue:** if the network drops mid-recording, the transcript is kept locally, the bar shows an offline indicator, and any message the user pressed Send on is queued and delivered as soon as connectivity returns.
6. **Auto-resume:** returning to the app with an unfinished recording restores the bar and the text captured so far rather than starting over.
7. Existing duplicate-word protection is kept exactly as it is.

---

## 3. Music workflow

- A dedicated Music workspace route listing generated tracks from `music_history`, with play, pause, seek, save, download, share, regenerate and delete.
- The player keeps playing while the user navigates between chat and music.
- Automatic music intent detection in chat stays; the card shows whether the piece is a short instrumental or a full song, along with the prompt and duration.
- Generation shows an animated in-progress state rather than a frozen bubble.

## 4. Theme

Refine the existing token system for contrast and consistency across dark and light, and sweep components for hardcoded colours into tokens. No new theme engine, no change to the stored preference key.

## 5. Authentication

Keep every working provider and the in-app-browser fallback. Improve the page itself: cleaner layout, clearer wording, visible language selection, better error and loading states, and a smoother path into Premium.

## 6. Response action bar

One consistent bar under every response: Copy, Like, Dislike, Regenerate, Share — plus Download and Edit on images, and Save on music. Like and Dislike persist through the existing feedback function and show their selected state.

## 7. Code blocks and live preview

Language detection with a professional header (language label, copy, download, and preview where relevant), correct wrapping and horizontal scroll on mobile, and a sandboxed live preview for HTML, CSS and JavaScript that can be expanded to full screen.

## 8. Sharing

One share entry point used by messages, images, music and copy cards, with the same icon and animation everywhere. It uses the device share sheet where available and falls back to the branded share-card image already implemented in `share-card.ts`.

## 9. Search

Search across thread titles and message content with partial matching, highlighted excerpts in the results, and tapping a result jumping to that exact message in the thread.

## 10. Long-press menus

On an AI message: Copy, Select text, Share, Pin, Details. On a user message: Edit, Copy, Select text, Delete. Identical behaviour for long-press on touch and right-click on desktop, with the existing chat-list long-press-to-delete untouched.

## 11. NizaHub integration

Build on the existing signed-request and signature-verification code: handle the incoming event types (identity update, sign-in, subscription created, changed and cancelled), apply them to the user's plan state, reconcile plan on login so a subscription bought elsewhere is honoured immediately, and show link and last-event status on the admin page.

---

## 12. Verification checklist

- Build and typecheck clean.
- Router regression set: plain chat, code request, clear image request, image edit with attachment, vision question, short music, full song, bare single word, incomplete instruction, conflicting intent, and a time-sensitive question.
- Clarification never fires on a complete image prompt, never fires twice for the same request, and never consumes quota.
- Memory: a fact is stored, retrieved on the next turn, overwritten when changed, and cleared from Profile. A message containing a password and an API key is proven to leave no stored row and no log entry.
- Aspect ratios produce exactly the pixel sizes listed, and regenerate keeps the same ratio.
- Speech-to-text tested on Android Chrome and iOS Safari including screen blur, resume, cancel, and offline send.
- Music playback continues across navigation; save, download and delete all work.
- Limits, the four free clean images, watermarking, and premium and admin bypasses all still behave as before.
- Auth works on every provider including inside an in-app browser.
- `user_memory` has RLS and grants; no new table is readable by another user.
- PWA still installs and works offline.

## Technical notes

- New: `src/lib/router-kb.ts`, `src/lib/memory.server.ts`, `src/components/VoiceRecorder.tsx`, a music workspace route, one migration for `user_memory`.
- Edited: `chat.server.ts` (router, ratios, web search, memory injection), `chat.functions.ts` (clarify path, memory write, ratio passthrough), `NizaApp.tsx`, `ChatMessage.tsx`, `CopyCard.tsx`, `CodeBlock.tsx`, `ImageViewer.tsx`, `MusicCard.tsx`, `niza-knowledge.ts`, the auth page and the NizaHub webhook route.
- All keys stay server-side; no provider or model name is ever exposed to a user.

---

## Clarification questions

1. **Web search provider** — no search API key exists in the project today. Should search run through the Lovable AI gateway's search-capable model (no new key, ships immediately), or do you want to supply a dedicated search API key?
2. **Music workspace placement** — its own page reached from the sidebar, or a tab inside the current workspace?
3. **Memory visibility** — should the memory list in Profile be read-only with a single Clear all, or should users be able to delete individual remembered facts?
4. **Clarification chips** — chips only, or chips plus the ability to just type a normal reply (typing always works either way)?
5. **Aspect ratio control** — inferred from the wording only, or also a small ratio picker in the composer for image requests?

I can start with sensible defaults for all five (gateway search, own Music page, per-item delete, chips plus free typing, inference only) if you would rather not decide now.
