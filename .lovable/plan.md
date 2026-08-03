# NovaMind AI — August 3 Completion Plan

Goal: finish the unfinished areas from August 1–2 without redesigning what already works. Everything below is delivered in one continuous pass.

## 1. Smart Copy — make it precise

Today Smart Copy triggers on length and list counts, so ordinary answers get boxed. New rule:

- The model tags reusable output itself. The system prompt instructs the assistant to wrap only copy-out artifacts (emails, letters, blog/social posts, documents, prompts, templates, configs, JSON, SQL, full code files, resumes, proposals) in a marker with a short title, e.g. `::artifact title="Marketing Email" kind="email"`.
- Client-side detection becomes a strict fallback: only a fenced code block or a marker activates Smart Copy. Length, list count, and heading count no longer trigger it.
- Titles come from the marker (or are inferred from the artifact kind): "Python Script", "Marketing Email", "Lovable Prompt", "SQL Query", "Business Proposal". No "Generated Content".
- Copy copies only the artifact body — no title, no chrome, no markers.
- Explanations that surround an artifact stay outside the card as normal chat text.

## 2. AI response action bar

Every assistant message gets one row, in this order: Copy, Like, Dislike, Regenerate, Share, Pin.

- Copy: response text only, markers stripped.
- Like / Dislike: saved silently to a `message_feedback` table; dislike offers optional written feedback afterwards without blocking the chat.
- Regenerate: re-runs only that response, in place.
- Share: opens the new share preview (section 3).
- Pin: section 8.

## 3 & 4. Universal share system

One shared component used everywhere: AI responses, images, music, code, documents, About page, user messages.

- Share opens a preview sheet showing a generated card rendered in-app to PNG (HTML/canvas — instant, no credits).
- Card template is chosen by content type: educational, business, quote, tutorial, story, developer/code. Each has NovaMind AI branding, auto title, clean typography and spacing.
- Actions: Share, Save Image, Cancel. Share uses the OS share sheet with the image file attached, so WhatsApp, Instagram, Facebook, TikTok, Telegram, X, Email and every installed app receive it. Text + link fallback when file sharing is unsupported.
- About NovaMind AI gains a Share option producing an app info card (branding, description, capabilities, version, app link).
- Privacy Policy gains a plain-language "What you may share" section: your own content, conversations, images, music, documents, and public NovaMind info — never admin data, hidden prompts, internal config, keys, security details, or other users' conversations.

## 5 & 6. Code blocks and live preview

- Header: auto-detected language label, Copy, and Preview when supported. Detection covers Python, JS, TS, HTML, CSS, SQL, JSON, C++, Java, Go, Rust, PHP and more, including inference when the fence has no language.
- Copy copies only the code.
- Better readability: tuned syntax theme, line spacing, soft wrapping for long lines, horizontal scroll only where needed, mobile-friendly sizing.
- Preview renders inline in a sandboxed interactive iframe (buttons, forms, navigation, scrolling all work) with a "Preview" label and Copy in the upper-right.
- Tapping anywhere in the preview opens fullscreen with a smooth animated transition; fullscreen keeps interactivity and adds Close, Copy and the Preview label.

## 7. Chat intelligence

- Send a rolling, summarised conversation context so long chats stay coherent without re-explaining.
- Detect topic switches and drop stale reasoning when the user clearly moves on.
- Resolve references such as "that", "it", "the second idea" from recent turns.
- New chats start with zero carry-over memory.
- Titles regenerate as short, memorable, professional labels (max ~4 words).

## 8. Search, conversation management, pinning

- Two search entry points: one at the top of the active chat, one in the drawer. Both search titles and message bodies, partial match, results update while typing.
- Selecting a result opens the conversation, scrolls to the message and highlights it briefly.
- Long-press a conversation: Rename and Delete in a proper action menu; Delete asks for confirmation and touches only that conversation.
- Pinning: Pin/Unpin on both user and AI messages, stored per conversation. A Pinned Messages panel reachable from the chat header lists preview, sender, date and time in chronological order; tapping jumps to and highlights the original message.

## 9. User message long-press menu

Edit, Select Text, Share, Details, Pin.

- Edit puts the message back in the composer; sending it creates a new message and a new response, leaving history intact.
- Select Text opens a selectable view with Copy selection, Select all, Share selection.
- Share uses the universal share card.
- Details shows time sent, character count, word count, message length, edited flag and model/context info.

## 10. Image upload workflow

- Selected images show as compact square thumbnails in a row above the composer, with remove buttons; the typed prompt stays in the input below, visually separate.
- Sent messages render the image(s) first, then the prompt underneath as a separate element in the same message.
- Real upload progress 0→100% driven by actual upload events, never frozen; the AI request fires only after upload completes.

## 11. Image generation

- Richer generating state: animated placeholder, staged status messages, progress where the provider reports it.
- Existing image viewer stays as-is.
- Consistent Download, Share, Regenerate, Edit on every generated image.
- Edit passes the original image plus the new instruction so context is preserved; a fresh generation happens only when explicitly requested.
- Image history entries record thumbnail, original prompt, generation time and model.

## 12. Nova Music

- New `/music` page: generate, history list, player. Chat keeps auto-detecting music requests and playing results inline.
- Intent routing decides instrumental / background / full song / lyrics-based / continuation / modification / remix without asking the user.
- History keeps title, prompt, date, duration and artwork where available, with Play, Download, Share, Regenerate.
- Player: play, pause, seek, progress bar, current and remaining time, smooth behaviour.
- Downloads get meaningful filenames derived from the request, never `audio.mp3`.
- Premium limits produce clear, friendly explanations; provider errors are never shown raw.

## 13. Authentication and first-run

- Redesigned sign-in screen: premium layout, branded illustration, refined typography and spacing, entrance animations, clear Google / Email sign-in, registration and password reset. Google keeps opening the account picker.
- Fixes the current hydration warning on this screen.
- Sign-up adds preferred-language selection, saved to the account.

## 14. Global language system

- Bundled UI translations for English, French, Spanish, German, Swahili, Chinese, Portuguese, Arabic (with RTL), Hindi, Igbo, Hausa and Yoruba, covering navigation, buttons, menus, settings, profile, About, Privacy, Support, notifications and error messages. Other languages keep an English UI while the AI replies in that language.
- Generated filenames — documents, music titles, image names — follow the app language.
- App language and conversation language stay independent: the AI understands input in any language, and instructions like "Reply in English", "Continue in Arabic", "Switch this chat to German" change only the conversation.

## 15. Speech to text

- Recording lifts the composer and shows animated waveform, live duration, an Upload (up arrow) button and a Save Draft (square) button beneath it.
- Upload: stop, transcribe, send automatically.
- Save Draft: stop, transcribe, drop the text into the composer for editing; nothing is sent.

## 16. Progress recovery and session continuity

- Composer drafts (text and attachments) autosave per conversation and restore after reload, refresh or unexpected close.
- Recording state is preserved when the app is backgrounded and resumes on return where the platform allows.
- Transcription started via Upload continues in the background and delivers the result when the user returns.

## Technical notes

- New tables: `message_feedback` (like/dislike + optional note), `pinned_messages`, and columns for language preference on `profiles`, plus prompt/model/duration metadata on generated media. All with RLS scoped to the owner and explicit grants.
- New modules: `src/lib/share-card.tsx` (card templates + canvas export), `src/components/ShareSheet.tsx`, `src/lib/i18n.ts` + locale files, `src/lib/artifact.ts` (marker parsing and titling), `src/lib/drafts.ts`.
- New route: `src/routes/_authenticated/music.tsx`.
- Reworked: `ChatMessage.tsx`, `CopyCard.tsx`, `CodeBlock.tsx`, `NovaMindApp.tsx`, `chat.functions.ts` (system prompt, context window, feedback/pin/search functions), `auth.tsx`, `profile.about.tsx`, `profile.privacy.tsx`.
- Existing working features — image viewer, payments, Nova Hub, admin dashboards, profile pages — are left intact.
