# Niza Prime AI — Part A roadmap (updated workflow, Oct 4)

Work strictly in this order.

## Earlier work (built; not verified signed-in)
- [x] Images via user's Puter account, compact placeholder, Retry
- [x] Speech-to-text single transcript
- [x] In-browser video editing

## Updated Part A
- [x] 1. Router audit — music routes removed from rules, classifier, clarifier, feature list
- [x] 2. Billing — 4 plans (₦7,000 / ₦2,500 / ₦2,500 / ₦2,000), server-set amounts, plan picker → review → Paystack, tier saved on profile, underpayment rejected
- [ ] 2b. Per-tier limits (chat vs images vs video) enforced in quota checks — currently any paid tier = premium
- [ ] 3. Mobile long-press menus (user: Pin/Copy/Edit/Share/Details; AI: Copy/Share/Pin/Details)
- [ ] 4. Auth redesign + onboarding (Account → Invitation → Promo → Privacy/Terms → Drive → Tutorial)
- [ ] 5. Promo code page + admin system
- [ ] 6. Settings overhaul (persistence, Clear All 10-day recovery, Archive)
- [ ] 7. Firebase Auth + FCM web push + public landing page at / + full /privacy page
- [ ] 8. Cleanup (music UI/docs/about page, old plan files) + final verification
- [x] Workflow 17 — multi-engine live search: general web + real images (Tavily), YouTube/videos incl. live streams (dedicated Gemini key), link reading (Firecrawl), fallback (Perplexity); no silent offline fallback; current date injected; in-app video player with YouTube fallback link; viral trends from public feeds
- [x] AssetLinks — public/.well-known/assetlinks.json served as plain JSON
- [x] Workflow 1 — public homepage at / (logged-in users go to /chat), public /privacy and /terms, full privacy policy shared with Profile screen, docs/help updated (music removed)
- [x] Configured: TAVILY_API_KEY + GEMINI_YOUTUBE_API_KEY saved via secret forms; Firecrawl + Perplexity connectors linked (managed, gateway-backed)

## Batch: Nov 5 2026 request (work top-down)

### Critical fixes
- [ ] CF1. Accurate limit alerts — remove false "limit reached" banners; show prompt only when the plan allowance is truly exhausted (no music leftovers in limit paths)
- [ ] CF2. Full-screen Plans page from sidebar "Upgrade"; keep the 4 micro-plans; image generation marked Premium
- [ ] CF3. Mobile containment 320–390px — no horizontal overflow in bubbles, action buttons, tooltips, code blocks
- [x] CF4. Remove leftover music-generation code/UI (MusicCard, music limit messages) — music gen is permanently removed

### New features (order)
- [ ] F1. Puter persistent session — survives reloads until user taps Disconnect in Settings; tokens stored securely (no plaintext long-lived creds in localStorage/profiles)
- [ ] F2. Long-press menus — AI: Pin, Details. User: Pin, Copy, Edit, Share (device share), Details
- [ ] F3. Per-user Drive connect + auto-save — drive.file OAuth per user, create Niza Prime AI/Documents|Images|Videos folders, auto-save generated images, uploaded docs, edited videos with retry + status badges; never Supabase Storage fallback
- [ ] F4. AI video editing suite — edit planner with prompt enhancement, plain-language checkboxes with bracketed technical terms, transitions, background music, TTS, FFmpeg commands via native bridge
- [ ] F5. Complete native bridge (src/lib/native-bridge.ts) — device info, permissions, native Google sign-in, phone/contacts/SMS/calendar, app launch/intents/sharing, FFmpeg execution, push, background mode
- [ ] F6. Onboarding modal post-signup — display name, username, language, discovery source, referral/promo code; referral link/code generation + sign-up tracking
- [ ] F7. Admin promo-code dashboard — create/edit codes, rules (duration, tier unlocks, limits), see who redeemed
- [ ] F8. Admin user analytics — acquisition sources, referral counts, usage patterns
- [ ] F9. SEO — GSC meta tag (y5aqO2Vx88qkxpDkJJ1RLi2mgWfuUAt9tW21_EftjC4) in root head, live robots.txt + sitemap.xml, Schema.org structured metadata, homepage credits Paschal Onah (14-year-old Nigerian developer) and Niza Prime AI

## Batch: Nov 6 2026 remaining critical items (work top-down)
- [ ] 1. Mobile containment at 320–390px — chat bubbles, actions, tooltips, code, tables, and composer
- [ ] 2. Persist and display every uploaded image/video attachment, including multiple images and reloads
- [ ] 3. Persistent Puter session with secure token handling and explicit Settings disconnect
- [ ] 4. Mobile long-press menus — AI: Pin/Details; user: Pin/Copy/Edit/device Share/Details
- [ ] 5. Per-user Google Drive OAuth (`drive.file`), folder setup, autosave/status/retry for images, documents, and edited videos
- [ ] 6. AI video edit planner, prompt enhancement, options, transitions, background audio, TTS, Android FFmpeg bridge
- [ ] 7. Complete Android native bridge to APK v1.0.1 contract
- [ ] 8. Post-signup onboarding and referral attribution
- [ ] 9. Admin promo-code dashboard and redemption tracking
- [ ] 10. Admin acquisition/usage analytics
- [ ] 11. SEO verification, robots/sitemap, structured metadata, creator attribution
