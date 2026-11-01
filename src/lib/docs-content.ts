// Single source of truth for public documentation and Help/FAQ content.
// Keep this in sync with what the application can actually do. Never put
// credentials, provider names, prompts, routes or infrastructure details here.

export type DocSection = {
  id: string;
  title: string;
  body: string[];
  bullets?: string[];
};

export const PRODUCT_SUMMARY =
  "Niza Prime AI is a single AI workspace. Chat is the centre of the app: hold a normal conversation, generate and edit images, search the live web with sources, find real photos and videos including live streams, read web links you paste, track what's trending, analyse pictures and documents, write and preview code, and edit videos — all from the same conversation.";

export const PUBLIC_MODELS = [
  { name: "Niza Chat 1.0", what: "Everyday conversation, explanations, writing and reasoning." },
  { name: "Niza Chat 1.1", what: "Backup conversation engine used when the primary engine is busy." },
  { name: "Niza Image 2.0", what: "Creates new images from a description." },
  { name: "Niza Image 2.1", what: "Edits and restyles pictures you already have." },
];

export const DOC_SECTIONS: DocSection[] = [
  {
    id: "chat",
    title: "Chat",
    body: [
      "Type what you need in the message box and send it. Niza Prime AI decides on its own what the request needs — a plain answer, a live search, a picture, code, or a video edit — so there are no commands to memorise.",
      "Conversations are saved to your account, so you can return to them from the panel on the left.",
    ],
  },
  {
    id: "images",
    title: "Images",
    body: [
      "Describe a picture and Niza Prime AI creates it. You can choose the shape of the picture before sending — square, portrait, tall, landscape or wide.",
      "Upload a picture to have it described or edited: background changes, object changes, style changes and touch-ups.",
    ],
  },
  {
    id: "search",
    title: "Search",
    body: [
      "When a question depends on current information — news, prices, results, weather, what's happening today — Niza Prime AI searches the live web across several search services and answers with links to its sources.",
      "Ask for a real picture of something and it finds real existing photos from the web. Ask for a video — including live match broadcasts, live church services and other live streams — and it plays it right inside the app with the official player; if a video can't be embedded, a direct link to watch it on YouTube is shown instead.",
      "Paste any web link into the chat and Niza Prime AI reads the page and answers your questions about it.",
      "Ask what's trending and it pulls trending music, dances and topics from public trend feeds such as Google Trends and TikTok's public Creative Center, always with sources.",
    ],
  },
  {
    id: "files",
    title: "Files and documents",
    body: [
      "Attach text documents, code files or images with the plus button. Niza Prime AI reads them and answers questions about their contents.",
    ],
  },
  {
    id: "code",
    title: "Code",
    body: [
      "Code answers arrive in a code box with syntax highlighting, a copy button and a download button. HTML, CSS and JavaScript answers include a live, sandboxed preview you can open full screen.",
    ],
  },
  {
    id: "video",
    title: "Video editing",
    body: [
      "Upload a video in Chat and describe the change in plain language — trim it, rotate it, mute it, speed it up, or convert it to a different shape. The edited video comes back into the same conversation.",
      "Your video stays attached to the conversation, so you can keep editing it without uploading it again.",
    ],
  },
  {
    id: "account",
    title: "Account, Settings and Help",
    body: [
      "Settings holds your preferred language and your accent colour. Help holds the tutorial, frequently asked questions and a link to Contact Support.",
      "A free account includes a daily allowance of messages and images. Premium raises those limits, removes the watermark and removes the short waiting delay.",
    ],
  },
];

export const FAQS: { q: string; a: string }[] = [
  {
    q: "Do I need special commands to generate an image?",
    a: "No. Describe the picture you want in the normal message box and Niza Prime AI works out that you want an image.",
  },
  {
    q: "How do I change the language of the app?",
    a: "Open Settings and pick your preferred language. If you chose one when you signed up, it is already selected and can be changed at any time.",
  },
  {
    q: "Can I change how the app looks?",
    a: "The base design is a fixed light theme. You can change the accent colour in Settings and it is remembered on your next visit.",
  },
  {
    q: "Where did my chat go?",
    a: "Conversations are listed in the panel on the left. On a phone, open that panel with the menu button. Press and hold a conversation to delete it.",
  },
  {
    q: "Is the information always correct?",
    a: "No AI service can guarantee that every answer is correct. Verify anything important, especially medical, legal or financial information.",
  },
  {
    q: "Can I keep editing the same video?",
    a: "Yes. Once a video is attached to a conversation it stays there, so you can ask for one change after another without uploading it again.",
  },
  {
    q: "Can I download YouTube videos?",
    a: "No. Video results are played through their official player and cannot be downloaded from Niza Prime AI.",
  },
  {
    q: "A video won't play inside the app. What do I do?",
    a: "Some videos and live streams can't be embedded by their owners. When that happens, a direct link to watch the video on YouTube is shown under the player.",
  },
  {
    q: "Can I share a web link and ask about it?",
    a: "Yes. Paste the link into the chat with your question and Niza Prime AI reads that page and answers from it.",
  },
  {
    q: "How do I contact a human?",
    a: "Open Help and use Contact Support. Replies appear in your support thread inside the app.",
  },
];

export const TUTORIAL_STEPS: { title: string; body: string }[] = [
  {
    title: "Welcome to Niza Prime AI",
    body: "One workspace for conversation, images, search, files, code and video. Everything happens in Chat.",
  },
  {
    title: "Just say what you need",
    body: "Ask a question, describe a picture, paste an error, or request current news. Niza Prime AI picks the right capability for you.",
  },
  {
    title: "Images and files",
    body: "Use the plus button to attach a picture, a document or a video. Ask for a description, an edit, or a summary.",
  },
  {
    title: "Search that is actually live",
    body: "For anything current, Niza Prime AI searches the web and shows its sources. It also finds real photos, plays videos and live streams inside the app, reads links you paste, and tracks what's trending.",
  },
  {
    title: "Code and preview",
    body: "Code arrives highlighted, with copy and download. HTML, CSS and JavaScript can be previewed live inside the answer.",
  },
  {
    title: "Settings and Help",
    body: "Open your profile to reach Settings for language and accent colour, and Help for this tutorial, FAQs and support.",
  },
];
