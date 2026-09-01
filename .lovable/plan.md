# Niza Prime AI — Launch Foundation (Prompt 1)

Scope: branding + white/cream theme, auth polish + tutorial, Settings/Help/Docs, router upgrade, search (web/image/YouTube), inline media, and a real Chat-based video editor. Existing auth, chat, image generation, music, payments and profile work stays as-is unless listed below.

## What exists today (verified)

- Chat shell `src/components/NizaApp.tsx`, message rendering `ChatMessage.tsx`, `CodeBlock.tsx`, `ImageViewer.tsx`.
- Router already exists: `src/lib/router-kb.ts` (rules + clarification + aspect ratios) and `routeRequest` in `src/lib/chat.server.ts`. It will be extended, not replaced.
- Theme is currently a dark/light + accent system (`src/lib/theme.ts`); dark is default.
- Profile pages exist (personal, privacy, about, support, feedback). There is **no** Settings page, **no** Help page, **no** `/docs`, **no** `robots.txt`/`sitemap.xml`.
- `OPENROUTER_API_KEY` is already configured. There is no Tavily key and no dedicated YouTube-search key.
- Composer disclaimer lives in `NizaApp.tsx` line ~754 and `i18n.ts` `chat.disclaimer`.
- No FFmpeg dependency yet. Server runtime is an edge worker, so video processing must run in the browser via FFmpeg WebAssembly in a web worker.

## 1. Branding and theme

- Add the uploaded grey logo as the single brand asset; use it in the app header, chat empty state, auth screens, loading states, profile row, Help, Docs, favicon and PWA icons (192/512 + maskable, regenerated from the same artwork, never recolored).
- Rework `src/styles.css` to a white / light-cream base (cream surfaces, soft borders, dark-slate text). Remove the dark/light switch: `theme.ts` keeps only accent selection, persisted in localStorage, default polished blue-purple. Existing stored dark preference is ignored gracefully.
- Audit components for hardcoded dark colors and move them onto tokens.

## 2. Authentication and first-use tutorial

- Restyle `src/routes/auth.tsx` for the new light theme; no change to auth logic, providers or accounts.
- Add Apple sign-in through the existing managed social-auth path (server-side verified, links by email). Requires enabling the Apple provider — no credentials invented.
- TikTok: assessed and **not** added; it has no supported provider in this auth stack. Documented rather than faked.
- First successful signup shows a dismissible tutorial overlay (what Niza Prime AI is, Chat, Images, Search, Files, Code, Settings, Help). Dismissal stored on the profile so it does not reappear; re-openable from Help.

## 3. Settings and Help

- New `/settings`: preferred language (seeded from signup choice, changeable, persisted), accent color, and the existing account controls surfaced from Profile.
- New `/help`: one page with FAQ, "Replay tutorial", product guidance, and a link into the **existing** Contact Support flow. No new support system.

## 4. Public Docs and SEO

- New public `/docs` (no auth): plain-English explanation of the product and its real capabilities, using public model names (Niza Chat 1.0/1.1, Niza Image 2.0/2.1). Content lives in one typed data file so docs and Help stay in sync with the app.
- Docs content is server-rendered crawlable HTML. Per-route `head()` with unique title, description, canonical, og/twitter tags. Add `public/robots.txt` and `public/sitemap.xml` covering `/`, `/auth`, `/docs`, `/help`.
- No keys, providers, prompts, routes or infrastructure appear anywhere in Docs.

## 5. Router upgrade

Extend the existing router to emit one validated decision object instead of a single mode:

```text
{ requires_chat, requires_search, search_type: web|image|youtube|combined|none,
  requires_image, requires_image_edit, requires_image_analysis, requires_code,
  requires_smart_copy, requires_video_editing, requires_file_processing,
  requires_speech_to_text, requires_clarification,
  requires_image_result, requires_video_result }
```

- Deterministic rules first, model classification for the ambiguous band, schema-validated result with a safe chat fallback. Keyword presence alone never triggers a capability.
- Conversation context (last turns, active media, pending clarification) is passed into classification so follow-ups resolve correctly.
- Clarification asks only for the missing piece.

## 6. Chat interface

- No redesign of working chat components or composer sizing.
- Remove the composer disclaimer text and its i18n string; the accuracy notice moves into Privacy Policy and Help.
- All new capabilities (search, video editing, file processing) surface inside Chat — no new nav items.

## 7. Code Box and Live Preview

- Extend `CodeBlock.tsx`: language detection and highlighting for Python, JS, TS, HTML, CSS, JSON, SQL, Java, C++, Go, Rust, PHP; Copy and Download; mobile-safe layout.
- For HTML/CSS/JS: sandboxed interactive iframe preview inside the block, plus an interactive fullscreen mode. Live Preview never becomes its own page.

## 8. Text selection

- Disable arbitrary selection on message bubbles only; inputs, textareas, code blocks, media controls and accessibility interactions keep native behavior. Users copy/select via the existing long-press actions.

## 9. Search system

One Search capability with three retrieval paths:

- **Web** — Tavily (current information, news, facts) with cited sources.
- **Image** — real existing images returned from search, never AI-generated substitutes.
- **YouTube** — real video results (thumbnail, title, channel, description, duration) with in-app embedded playback; no downloads, no restriction bypass.
- **Combined** — text + image + video only when the request genuinely needs all three.

Both keys are stored server-side only and read inside server handlers.

## 10. Media display in Chat

- New shared media components: images and videos render inline at their true aspect ratio, compact and responsive, never stretched or forced square, never full-screen by default.
- Tap image → in-app lightbox. Tap video → in-app player with play/pause, seek, volume, fullscreen.
- Download appears only when the file is genuinely downloadable. Share sends the actual item (image/video/text) via Web Share where supported, and reports real success/failure only.

## 11. Video editing (Chat-based, real)

- Upload video in Chat → router flags `requires_video_editing` → the request goes to an OpenRouter-backed intelligence layer that returns **structured operations only** (e.g. `{operation:"trim",start:5,end:30}`), validated against a schema. Model id is configurable, defaulting to a free OpenRouter route; the model never emits FFmpeg commands.
- FFmpeg WebAssembly runs in a dedicated web worker in the browser so Chat never freezes.
- Operations: trim, split, merge, crop, resize, rotate 90 cw/ccw/180, h/v flip, speed, mute, volume, reverse, compression/export quality, aspect-ratio conversion (1:1, 4:3, 3:4, 16:9, 9:16, original — crop, never stretch), audio replacement, background audio, text overlay, image overlay, brightness, contrast, saturation, grayscale, basic fades.
- Import/replace/remove video with validation of size, duration, type, codec and processing limits, with plain-language errors.
- **Continuity:** an editing project is held per conversation — source asset, applied operations, pending clarification, current output. Answering a clarification continues the same edit; further edits reuse the same video; "make it 9:16" resolves to the current edited video; an unrelated message returns to normal chat. No re-uploads.
- Undo/redo over the operation list, re-encoding only on export rather than after every action.
- Progress states: Preparing video, Loading video engine, Processing, Rendering, Finalizing, Export complete — percentage only when reliable. Cancel stops work, cleans temp files, keeps the project, and is not reported as an export.
- Cleanup of object URLs, FFmpeg temp files and superseded blobs.
- Result returns inline in the same conversation with correct aspect ratio, playback, fullscreen, download and share. Raw FFmpeg logs and paths are never surfaced.

## 12. Privacy and legal

Privacy Policy and About gain an accuracy/data-handling section explaining that AI output can be wrong and important information should be verified. No provider or infrastructure details.

## 13. PWA

Manifest updated with the grey branding icons, correct name/short name, start URL, scope, standalone display; service worker keeps caching static assets only and never caches auth or API requests.

## 14. Testing

Real end-to-end passes in the running app: signup, signin, tutorial, Settings (language + accent), Help, FAQ, Contact Support, Docs, chat, image generation/editing/analysis, Code Box + live preview, the "Gege" / "Nigeria today" / "Nigerian flag" / "futuristic Nigerian city" search prompts, upload + inline media, and the full video flow (trim → clarification → answer → "Make it 9:16" → export → download). Anything broken gets fixed before completion.

## Credentials I will request at build time

1. **Google Gemini API key** — YouTube/video search.
2. **Tavily API key** — web search and current information.

OpenRouter is already configured and will be reused for the video-editing intelligence layer.
