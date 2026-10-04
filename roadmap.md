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
- Blocked: web search needs TAVILY_API_KEY + GEMINI_API_KEY
