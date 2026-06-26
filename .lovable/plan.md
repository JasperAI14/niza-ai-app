## Add OpenRouter to NovaMind AI fallback chains

### Security note
The OpenRouter key you pasted in chat is now exposed — please rotate it at https://openrouter.ai/keys once setup is done. I'll store the key as a secret (`OPENROUTER_API_KEY`) using `set_secret` (no form needed since you already gave me the value).

### Steps

1. **Store secret**
   - `OPENROUTER_API_KEY` = the value you pasted.

2. **Edit `src/lib/chat.functions.ts`** — add two new provider functions:
   - `callOpenRouterText(messages)` → POSTs to `https://openrouter.ai/api/v1/chat/completions` with model `x-ai/grok-4-fast:free` (free tier on OpenRouter, good fallback). Standard OpenAI-compatible body.
   - `callOpenRouterImage(prompt)` → POSTs to `https://openrouter.ai/api/v1/chat/completions` with model `google/gemini-2.5-flash-image-preview` using the multimodal `messages` + `modalities: ["image","text"]` shape, then extracts the base64 image from `choices[0].message.images[0].image_url.url` (data URL).

3. **Update fallback chains** in the same file:
   - Text: `Grok → Gemini → Lovable → OpenRouter → HuggingFace`
   - Image: `Lovable → OpenRouter → Stability → OpenAI → HuggingFace`

4. **Verify** with a quick `curl` test against both OpenRouter endpoints using the new key to confirm it works before declaring done.

### Out of scope
No UI changes, no DB changes, no changes to auth/limits/intent detection.
