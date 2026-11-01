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
- [ ] Pending user input: TAVILY_API_KEY + GEMINI_YOUTUBE_API_KEY values (secret forms), Firecrawl + Perplexity connections (cards)
