// Router Knowledge Base for Niza Prime AI.
//
// Single source of truth for:
//   - how a request is classified into a mode
//   - what every feature of the app is and where it lives
//   - aspect-ratio inference for image generation
//   - clarification behaviour for vague requests
//
// This file is client-safe (pure data + pure functions) so both the server
// router and UI helpers can import it.

export type RouteMode =
  | "CHAT"
  | "CODE"
  | "IMAGE_GEN"
  | "IMAGE_EDIT"
  | "VISION"
  | "MUSIC_SHORT"
  | "MUSIC_SONG"
  | "WEB_SEARCH"
  | "CLARIFY";

// ---------------------------------------------------------------- ratios
export type AspectRatio = "1:1" | "3:4" | "9:16" | "4:3" | "16:9";

export const RATIO_SIZES: Record<AspectRatio, { width: number; height: number; label: string }> = {
  "1:1": { width: 1024, height: 1024, label: "Square" },
  "3:4": { width: 896, height: 1152, label: "Portrait" },
  "9:16": { width: 768, height: 1344, label: "Tall" },
  "4:3": { width: 1152, height: 896, label: "Landscape" },
  "16:9": { width: 1344, height: 768, label: "Wide" },
};

export const RATIO_ORDER: AspectRatio[] = ["1:1", "3:4", "9:16", "4:3", "16:9"];

/** Explicit request wins; otherwise infer from the subject of the picture. */
export function inferAspectRatio(text: string): AspectRatio {
  const t = (text ?? "").toLowerCase();
  const explicit = /\b(1\s*[:x]\s*1|3\s*[:x]\s*4|9\s*[:x]\s*16|4\s*[:x]\s*3|16\s*[:x]\s*9)\b/.exec(t);
  if (explicit) {
    const norm = explicit[1].replace(/\s|x/g, ":");
    if (RATIO_ORDER.includes(norm as AspectRatio)) return norm as AspectRatio;
  }
  if (/\b(square)\b/.test(t)) return "1:1";
  if (/\b(vertical|portrait|phone\s*(background|wallpaper)|story|reel|tiktok)\b/.test(t)) return "9:16";
  if (/\b(wallpaper|lock\s*screen|home\s*screen)\b/.test(t)) return "9:16";
  if (/\b(banner|cover|thumbnail|header|widescreen|landscape|horizontal|youtube)\b/.test(t)) return "16:9";
  if (/\b(poster|flyer|book\s*cover|magazine)\b/.test(t)) return "3:4";
  if (/\b(profile\s*(picture|photo)|avatar|icon|logo|sticker)\b/.test(t)) return "1:1";
  if (/\b(photo|photograph|scene|landscape\s+of)\b/.test(t)) return "4:3";
  return "1:1";
}

// ------------------------------------------------------- feature knowledge
export type FeatureEntry = {
  name: string;
  what: string;
  where: string;
};

export const FEATURES: FeatureEntry[] = [
  { name: "Chat", what: "Conversation, explanations, tutoring, writing help.", where: "The main screen. Type in the box at the bottom and press Send." },
  { name: "New chat", what: "Starts a fresh conversation.", where: "Left panel, the New chat button at the top. On phones open the panel with the menu button." },
  { name: "Delete a chat", what: "Removes a conversation permanently.", where: "Press and hold a chat in the left panel, then choose Delete." },
  { name: "Images", what: "Creates a picture from a description.", where: "Just describe the picture in the chat box and send it — no command needed. A ratio picker sits above the box." },
  { name: "Image ratios", what: "Chooses the shape of a generated picture: square, portrait, tall, landscape or wide.", where: "The ratio picker just above the message box." },
  { name: "Image editing", what: "Background changes, object changes, style changes, touch-ups.", where: "Upload a picture with the plus button, or open a generated image and choose Edit, then describe the change." },
  { name: "Image analysis", what: "Reads and describes an uploaded picture, including text inside it.", where: "Attach the picture with the plus button and ask your question." },
  { name: "Music", what: "Short instrumental pieces and full songs.", where: "Ask for it in chat, or open the Music workspace from the left panel." },
  { name: "Smart Copy", what: "Collapses reusable output — code, emails, essays, plans — into a card you can copy or download.", where: "Appears automatically on that kind of response." },
  { name: "Code blocks", what: "Syntax-highlighted code with copy, download and live preview for HTML, CSS and JavaScript.", where: "Appears automatically in answers containing code." },
  { name: "Speech to text", what: "Dictate a message instead of typing it.", where: "The microphone button beside the message box. Stop puts the text in the box for review; Send sends it." },
  { name: "Search", what: "Finds chats by title and messages by content.", where: "The search box at the top of the left panel." },
  { name: "Profile", what: "Your account hub.", where: "The profile row at the bottom of the left panel." },
  { name: "Personal Information", what: "Profile picture, display name, username, and what Niza remembers about you.", where: "Profile then Personal Information." },
  { name: "Privacy Policy", what: "How your data is handled.", where: "Profile then Privacy Policy." },
  { name: "Contact Support", what: "Send a support request and track replies.", where: "Profile then Contact Support." },
  { name: "About", what: "What Niza Prime AI is and who made it.", where: "Profile then About Niza Prime AI." },
  { name: "Feedback and reviews", what: "Rate the app and leave a review.", where: "Profile then Send Feedback." },
  { name: "Theme", what: "Dark or light mode, plus an accent colour. The two are independent.", where: "Profile then Settings." },
  { name: "Sign out", what: "Ends your session on this device.", where: "Profile, then Sign Out at the bottom." },
  { name: "Premium", what: "Higher text and image limits, no watermark, no waiting delay.", where: "The upgrade prompt when a limit is reached, or Profile then Upgrade." },
  { name: "NizaHub", what: "The account, sign-in, subscription and payment platform behind your Niza Prime AI account.", where: "Sign-in and subscription screens are handled through it automatically." },
  { name: "Administrator tools", what: "Reviews, support requests, error reports and payments dashboards for administrators only.", where: "Profile then the Admin section, visible only to administrators." },
];

export const NAVIGATION_KB = FEATURES.map((f) => `- ${f.name}: ${f.what} Where: ${f.where}`).join("\n");

// -------------------------------------------------------------- rules
type ModeRule = {
  mode: RouteMode;
  strong: RegExp[];
  weak?: RegExp[];
  block?: RegExp[];
};

const RULES: ModeRule[] = [
  {
    mode: "MUSIC_SONG",
    strong: [
      /\b(write|make|create|compose|generate|produce|sing)\b[^.?!]{0,40}\b(song|anthem|hymn|ballad)\b/i,
      /\b(song|track)\b[^.?!]{0,30}\b(with (vocals|words|lyrics)|that sings)\b/i,
    ],
    block: [/\b(lyrics|words)\s+(only|just)\b/i, /^\s*write\s+(me\s+)?(the\s+)?lyrics\b/i],
  },
  {
    mode: "MUSIC_SHORT",
    strong: [
      /\b(make|create|generate|compose|produce|give me)\b[^.?!]{0,40}\b(instrumental|beat|melody|loop|riff|jingle|background music|soundtrack)\b/i,
      /\b(make|create|generate|compose)\b[^.?!]{0,30}\b(music|tune|track)\b/i,
    ],
    block: [/\b(lyrics|words)\s+(only|just)\b/i, /\brecommend\b/i, /\bplaylist\b/i],
  },
  {
    mode: "IMAGE_GEN",
    strong: [
      /\b(generate|create|make|draw|paint|design|render|produce|sketch|illustrate|give me)\b[^.?!]{0,40}\b(image|picture|photo|pic|illustration|drawing|painting|artwork|art|logo|wallpaper|poster|portrait|icon|banner|thumbnail|avatar|mockup|sticker)\b/i,
      /\b(image|picture|photo|illustration|drawing|painting|artwork|logo|poster|wallpaper|banner)\s+of\s+\S+/i,
      /^\s*(draw|paint|sketch|illustrate|render|imagine|visuali[sz]e)\s+\S+/i,
    ],
    block: [/\bdescribe\b/i, /\bwhat('s| is)\s+in\s+(this|the)\s+(image|picture|photo)\b/i, /\bexplain\b/i],
  },
  {
    mode: "WEB_SEARCH",
    strong: [
      /\b(latest|breaking|today'?s?|current|right now|this (week|month|year)|up to date|recent)\b[^.?!]{0,60}\b(news|price|prices|rate|rates|score|scores|update|release|version|weather|results?)\b/i,
      /\b(who is (the )?(current|present)|what is the (current|latest))\b/i,
      /\b(exchange rate|stock price|share price|market cap|bitcoin price|crypto price)\b/i,
      /\b(news|headlines)\b[^.?!]{0,30}\b(today|now|this week)\b/i,
      /\bin\s+20(2[6-9]|[3-9]\d)\b/i,
    ],
  },
  {
    mode: "CODE",
    strong: [
      /\b(write|fix|debug|refactor|review|optimi[sz]e|explain)\b[^.?!]{0,30}\b(code|function|class|script|component|query|regex|api|bug|error|stack trace)\b/i,
      /```/,
      /\b(typescript|javascript|python|java|rust|golang|kotlin|swift|php|sql|css|html|react)\b[^.?!]{0,40}\b(code|function|script|component|snippet|example)\b/i,
    ],
    weak: [/\b(code|function|bug|compile|refactor|regex|sql|typescript|javascript|python|css|html|component|debug)\b/i],
  },
];

// Single bare words / fragments that cannot be acted on as-is.
const VAGUE_STARTERS =
  /^(translate|summari[sz]e|fix|explain|rewrite|improve|continue|convert|analy[sz]e|check|review)\s+(this|that|it)\.?$/i;

const INCOMPLETE_MEDIA =
  /^(create|make|generate|compose|write|draw|produce)\s+(me\s+)?(a\s+|an\s+|some\s+)?(music|song|image|picture|photo|code|story|essay|poem|logo|design|app|website)\.?$/i;

export type KBMatch = {
  mode: RouteMode;
  confidence: number; // 0..1
  reason: string;
};

/** Rules-first classification. Returns null when nothing matched at all. */
export function matchKnowledgeBase(text: string): KBMatch | null {
  const t = (text ?? "").trim();
  if (!t) return null;

  for (const rule of RULES) {
    if (rule.block?.some((re) => re.test(t))) continue;
    if (rule.strong.some((re) => re.test(t))) {
      return { mode: rule.mode, confidence: 0.92, reason: "strong" };
    }
  }
  for (const rule of RULES) {
    if (rule.block?.some((re) => re.test(t))) continue;
    if (rule.weak?.some((re) => re.test(t))) {
      return { mode: rule.mode, confidence: 0.55, reason: "weak" };
    }
  }
  return null;
}

/** True when the message is too thin to act on. */
export function needsClarification(text: string): boolean {
  const t = (text ?? "").trim().replace(/[?!.]+$/, "");
  if (!t) return false;
  if (VAGUE_STARTERS.test(t)) return true;
  if (INCOMPLETE_MEDIA.test(t)) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && !/[?]/.test(text) && !/^(hi|hey|hello|yo|thanks|thank you|ok|okay|yes|no|sure|cool|nice|good morning|good evening|good afternoon)$/i.test(t)) {
    return true;
  }
  return false;
}

const OPENERS = [
  (s: string) => `How can I help you with ${s}?`,
  (s: string) => `What do you need about ${s}?`,
  (s: string) => `What would you like to know or make about ${s}?`,
  (s: string) => `Happy to help with ${s} — what are you after?`,
];

/** A short, varied clarification question plus tappable options. */
export function buildClarification(text: string, turn = 0): { question: string; options: string[] } {
  const t = text.trim().replace(/[?!.]+$/, "");
  const lower = t.toLowerCase();

  if (/^(translate|summari[sz]e|rewrite|convert)\s+(this|that|it)$/i.test(t)) {
    const verb = lower.split(/\s+/)[0];
    return {
      question:
        verb.startsWith("translate")
          ? "Sure — which text should I translate, and into which language?"
          : `Sure — paste the text you'd like me to ${verb}.`,
      options: [],
    };
  }
  if (/^(fix|debug|explain|review|check|analy[sz]e|improve|continue)\s+(this|that|it)$/i.test(t)) {
    return { question: "Happy to — paste the code or text you're referring to.", options: [] };
  }
  if (/^(create|make|generate|compose|write)\s+(me\s+)?(a\s+|an\s+|some\s+)?(music|song)$/i.test(t)) {
    return {
      question: "What mood or style should it have, and should it have vocals?",
      options: ["Calm piano instrumental", "Upbeat afrobeats track", "A song with vocals"],
    };
  }
  if (/^(create|make|generate|draw)\s+(me\s+)?(a\s+|an\s+)?(image|picture|photo|logo|design)$/i.test(t)) {
    return { question: "What should the picture show?", options: [] };
  }
  if (/^write\s+(me\s+)?(some\s+)?(python|javascript|typescript|java|c\+\+|go|rust|php|sql|html|css)?\s*code$/i.test(t)) {
    return { question: "What should the code do?", options: [] };
  }
  if (/^(html|css|javascript|typescript|python|java|sql|react|rust|go|php)$/i.test(t)) {
    const lang = t.toUpperCase() === "HTML" || t.toUpperCase() === "CSS" || t.toUpperCase() === "SQL" ? t.toUpperCase() : t[0].toUpperCase() + t.slice(1);
    return {
      question: `What would you like to do with ${lang} — learn it, write something, or fix something?`,
      options: [`Explain ${lang} basics`, `Write ${lang} for me`, `Review my ${lang}`],
    };
  }

  const subject = t.toLowerCase();
  const question = OPENERS[turn % OPENERS.length](subject);
  return {
    question,
    options: [`Picture of ${subject}`, `Facts about ${subject}`, `A story about ${subject}`],
  };
}
