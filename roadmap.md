# Niza Prime AI — Part A roadmap

Source of truth: the "Master Implementation Plan — Part A" message. Work in order.

## Done (built, typecheck clean; not yet verified end-to-end)
- [x] 1. Image: compact square placeholder, natural-ratio compact final image, Puter migration (user-linked account verified server-side), failure + Retry on same message, Regenerate via Puter, fixed image allowance removed from sidebar/warnings/gating
- [x] 2. Speech-to-text: record -> stop -> transcribe once (/api/transcribe) -> insert once; Send while recording; Cancel discards; mic-denied handling
- [x] Video editing: uploads up to 500MB, FFmpeg in-browser edit saved to conversation

## Next (exact resume point)
- [ ] 1 leftover: image EDIT still on old provider; docs text about images
- [ ] 3. Router audit (Smart Copy, Code Box, image, web, URL research, video edit; remove music routes)
- [ ] 4. Long-press menus (user: Pin/Copy/Edit/Share/Details; AI: Copy/Share/Pin/Details)
- [ ] 5. Auth redesign + onboarding + Google Drive storage
- [ ] 6. Promo code system (admin CRUD, secure redemption, rewards)
- [ ] 7. Settings (language/accent persistence, Clear All with 10-day recovery, Archive)
- [ ] 8. Premium plans + Paystack (₦7,000 / ₦2,500 / ₦2,500 / ₦2,000)
- [ ] 9. Web search (Tavily, Gemini YouTube), URL research, video editing stabilization — blocked on TAVILY_API_KEY and GEMINI_API_KEY
- [ ] 10. Docs cleanup, remove music references, migrate + delete 3 old plan files
- [ ] 11. Final end-to-end verification
