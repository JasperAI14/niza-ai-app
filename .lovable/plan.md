````text
PLAN: Rotate/update API keys for NovaMind AI

1. Rotate LOVABLE_API_KEY
   - Use ai_gateway--rotate_lovable_api_key (managed secret).
   - No user input needed; it regenerates the project key automatically.

2. Update third-party AI provider keys
   - Present secure update forms for the keys you want to replace:
     - STABILITY_API_KEY
     - OPENAI_API_KEY
     - HUGGINGFACE_API_KEY
     - GROK_API_KEY
     - GEMINI_API_KEY
   - You only need to update the ones that are expired/out of credits; the others can stay.

3. Restart the dev server if needed
   - Server functions read env at runtime, so a restart ensures new keys are active.

4. Test both capabilities
   - Text/chat: send a message and verify the multi-provider fallback chain works.
   - Image generation: trigger an image prompt, verify the new Lovable Gateway image endpoint returns data, and that fallback providers still chain correctly.

5. Report results
   - List which providers returned successful responses and which still fail (e.g. 402/400 due to billing).
````

Which third-party keys do you want to update now? You can name them all, or only the ones you have fresh values for.