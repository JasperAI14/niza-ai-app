# Niza Prime AI

Build a full-stack AI assistant web application called "Niza Prime AI".



This app should behave like ChatGPT and support multiple AI capabilities in one unified system.



────────────────────────

CORE PURPOSE



NovaMind AI is an advanced AI assistant that can:

- Chat naturally with users

- Write and debug code

- Generate images from text prompts

- Explain concepts

- Help with writing, learning, and problem-solving



This is NOT a video app. Focus only on chat, code, and image generation.



────────────────────────

1. AI CHAT SYSTEM (MAIN FEATURE)



- Users can send messages to an AI assistant

- AI responds in a ChatGPT-like interface

- Conversations must be saved per session

- Users can:

  • Continue last chat automatically

  • Create new chats

  • View chat history in a sidebar



- The AI must support:

  • General conversation

  • Coding help (JavaScript, Python, HTML, etc.)

  • Problem solving

  • Explanations and tutoring



────────────────────────

2. AI IMAGE GENERATION



- Users can generate images from text prompts

- Images must appear inside chat as responses

- Images must be saved in history

- Users can re-open and re-download images anytime



API INTEGRATION:

- Use Stability AI for image generation

- Store API key securely in backend environment variables:

  STABILITY_API_KEY



Backend endpoint:

POST /api/image

- Input: text prompt

- Output: generated image URL



────────────────────────

3. AI TEXT ENGINE (CHAT BRAIN)



- Use Grok AI (or compatible LLM API) for chat responses

- All user messages must be sent to backend API

- AI must return structured responses:

  - text answer

  - optional code blocks when needed



API INTEGRATION:

- Store API key securely:

  GROK_API_KEY 



Backend endpoint:

POST /api/chat

- Input: user message

- Output: AI response



────────────────────────

4. CODE GENERATION MODE



AI must be able to:

- Write clean code

- Debug errors

- Explain code step-by-step

- Generate full HTML/CSS/JS projects

- Help with backend (Node.js, Python basics)



Code must be formatted properly in code blocks.



────────────────────────

5. USER INTERFACE (CHATGPT STYLE)



UI must include:

- Left sidebar (chat history)

- Main chat window

- Message input box at bottom

- Send button

- Loading animation while AI is thinking

- Image results shown inline inside chat



Design style:

- Dark mode default

- Clean modern UI

- Mobile responsive



────────────────────────

6. DATA STORAGE



- Save chat history per user/session

- Save generated images with timestamps

- Allow users to revisit previous chats



Storage can use:

- Local storage (initial version)

- Upgrade-ready for Firebase later



────────────────────────

7. ERROR HANDLING



- If AI fails, show:

  "AI is currently unavailable. Please try again."

- Never crash the app UI

- Always return fallback message



────────────────────────

8. BACKEND RULES



- NEVER expose API keys in frontend code

- All API calls must go through backend routes

- Use environment variables only



Required environment variables:

- GROK_API_KEY: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

- STABILITY_API_KEY:sk-57FXCFLqceADXYCj64ZHDPG6NXuETqDS6W0O1LJz1jN1YByU



────────────────────────

FINAL GOAL



A fully working NovaMind AI system that includes:

- ChatGPT-like AI chat

- Code generation ability

- Image generation (Stability AI)

- Chat history + memory

- Clean modern UI

- Secure backend API structure

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://niza-ai-app.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4efc0171-0468-4a14-9bd5-92030e5b5d2f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
