// Multi-engine live search for Niza Prime AI.
//
// Design rules (never break these):
//   - The Router decides whether a request needs live search and what kind of
//     results it needs (text, real images, videos, or viral trends).
//   - Engines are layered: a general web engine, a web/YouTube-aware engine,
//     a link reader for user-provided URLs, and an answer engine as fallback.
//   - Engine and provider names are NEVER shown to end users. Every failure
//     collapses into one generic "search unavailable" message.
//   - A failed search NEVER silently falls back to offline text generation
//     presented as current information.
//   - The server's real current date is injected into every search context so
//     relative words (today, latest, current) mean the actual present.
//
// This module matches *.server.* so it is excluded from client bundles; it is
// imported only inside server-function handlers (same pattern as chat.server.ts).

import { generateText } from "./chat.server";
import type { SearchKind } from "./router-kb";

export type { SearchKind };
export type WebSource = { title: string; url: string };
export type VideoResult = { title: string; url: string; videoId: string | null; live: boolean };
export type ImageResult = { title: string; url: string };

export type SearchResult =
  | { ok: true; text: string; sources: WebSource[]; videos: VideoResult[]; images: ImageResult[] }
  | { ok: false; error: string };

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

const ERR_TEXT = "Live search isn't available right now, so I can't provide current information. Please try again in a little while.";
const ERR_VIDEO = "I couldn't find live video results for that right now. Please try again shortly, or paste a YouTube link directly.";
const ERR_IMAGE = "Real image search isn't available right now. Please try again shortly.";
const ERR_LINK = "Reading links isn't available right now, so I couldn't analyse that page. Please try again shortly.";

// ---------------------------------------------------------------- date

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function todayContext(): string {
  const now = new Date();
  return `${DAYS[now.getUTCDay()]}, ${MONTHS[now.getUTCMonth()]} ${now.getUTCDate()}, ${now.getUTCFullYear()} (${now.getUTCHours().toString().padStart(2, "0")}:${now.getUTCMinutes().toString().padStart(2, "0")} UTC)`;
}

// ---------------------------------------------------------------- engines

type TavilyHit = { answer: string; results: WebSource[]; contents: string[]; images: ImageResult[] };

async function tavilySearch(
  query: string,
  opts: { maxResults?: number; images?: boolean; topic?: "general" | "news" } = {},
): Promise<TavilyHit | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        topic: opts.topic ?? "general",
        search_depth: "advanced",
        max_results: opts.maxResults ?? 8,
        include_answer: true,
        include_images: !!opts.images,
        include_image_descriptions: !!opts.images,
      }),
    });
    if (!r.ok) {
      console.error(`[search] web engine ${r.status}`);
      return null;
    }
    const j: any = await r.json();
    const results: WebSource[] = (j.results ?? [])
      .map((x: any) => ({ title: x.title || x.url, url: x.url }))
      .filter((x: WebSource) => !!x.url);
    const contents: string[] = (j.results ?? []).map((x: any) => x.content ?? "");
    const images: ImageResult[] = (j.images ?? [])
      .map((im: any) => (typeof im === "string" ? { title: "", url: im } : { title: im.description || "", url: im.url }))
      .filter((im: ImageResult) => !!im.url)
      .slice(0, 8);
    return { answer: j.answer ?? "", results, contents, images };
  } catch (e) {
    console.error("[search] web engine failed:", (e as Error).message);
    return null;
  }
}

async function perplexitySearch(query: string, maxResults = 8): Promise<WebSource[] | null> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return null;
  try {
    if (key.startsWith("lovc_")) {
      const lk = process.env.LOVABLE_API_KEY;
      if (!lk) return null;
      const r = await fetch("https://connector-gateway.lovable.dev/perplexity/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ query, max_results: maxResults }),
      });
      if (!r.ok) {
        console.error(`[search] answer engine ${r.status}`);
        return null;
      }
      const j: any = await r.json();
      return (j.results ?? []).map((x: any) => ({ title: x.title || x.url, url: x.url })).filter((x: WebSource) => !!x.url);
    }
    const r = await fetch("https://api.perplexity.ai/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!r.ok) {
      console.error(`[search] answer engine ${r.status}`);
      return null;
    }
    const j: any = await r.json();
    return (j.results ?? []).map((x: any) => ({ title: x.title || x.url, url: x.url })).filter((x: WebSource) => !!x.url);
  } catch (e) {
    console.error("[search] answer engine failed:", (e as Error).message);
    return null;
  }
}

async function geminiCall(key: string, model: string, prompt: string, tools: any[] | null): Promise<any> {
  const body: Record<string, any> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: "You are a precise research assistant. Follow the user's instructions exactly." }] },
  };
  if (tools) body.tools = tools;
  const r = await fetch(`${GEMINI_BASE}/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`${model} ${r.status} ${t.slice(0, 160)}`);
  }
  return r.json();
}

/** YouTube-aware live search: finds real videos, including live streams. */
async function videoEngineSearch(query: string): Promise<VideoResult[]> {
  const key = process.env.GEMINI_YOUTUBE_API_KEY;
  if (!key) return [];
  const prompt = `Find real YouTube videos about: ${query}
Today is ${todayContext()}.
Include live streams when they are relevant (live match broadcasts, live church services or prayers, live news channels, ongoing live events). Prefer current, official and high-quality videos.
Reply with ONLY a JSON array (no markdown fence, no other text) of up to 8 objects, each exactly:
{"title": "<video title>", "url": "<full YouTube URL>", "live": true or false}
Use real YouTube URLs of the forms https://www.youtube.com/watch?v=... , https://youtu.be/... or https://www.youtube.com/live/... . Never invent a URL.`;
  try {
    const j = await geminiCall(key, "gemini-2.5-flash", prompt, [{ google_search: {} }]);
    const cand = j?.candidates?.[0];
    const text = cand?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    const seen = new Set<string>();
    const out: VideoResult[] = [];
    const add = (title: string, url: string) => {
      const id = youtubeId(url);
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push({ title: (title || url).trim(), url: `https://www.youtube.com/watch?v=${id}`, videoId: id, live: /\/live\/|\blive\b/i.test(url) || /\blive\b/i.test(title) });
    };
    const fence = /\[[\s\S]*\]/.exec(text);
    if (fence) {
      try {
        for (const v of JSON.parse(fence[0])) {
          if (v?.url) add(String(v.title ?? ""), String(v.url));
        }
      } catch {
        /* fall through to URL scan */
      }
    }
    for (const c of cand?.groundingMetadata?.groundingChunks ?? []) {
      const uri = c?.web?.uri;
      if (uri && /youtu\.be|youtube\.com/i.test(uri)) add(c?.web?.title ?? "", uri);
    }
    for (const m of text.matchAll(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?[^\s")]*v=|live\/|shorts\/)|youtu\.be\/)[\w-]+/gi)) {
      add("", m[0]);
    }
    return out.slice(0, 8);
  } catch (e) {
    console.error("[search] video engine failed:", (e as Error).message);
    return [];
  }
}

/** Google Trends public feed — free, no key. */
async function googleTrendsItems(geos: string[] = ["NG", "US"]): Promise<Array<{ title: string; geo: string; traffic?: string }>> {
  const out: Array<{ title: string; geo: string; traffic?: string }> = [];
  await Promise.all(
    geos.map(async (geo) => {
      try {
        const r = await fetch(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; NizaPrimeAI/1.0)" },
        });
        if (!r.ok) return;
        const xml = await r.text();
        for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
          const title = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(m[1])?.[1]?.trim();
          const traffic = /<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/.exec(m[1])?.[1]?.trim();
          if (title) out.push({ title, geo, traffic });
        }
      } catch {
        /* best effort */
      }
    }),
  );
  return out.slice(0, 24);
}

/** TikTok Creative Center public trend pages, when the link reader is available. */
async function tiktokTrendsItems(): Promise<string[]> {
  const page = await firecrawlScrape("https://ads.tiktok.com/business/creativecenter/pc/music?region=NG", 20000);
  if (!page) return [];
  const titles = [...page.markdown.matchAll(/(?:^|\n)\s*(?:#+\s*)?([\w'"&’() .:-]{3,60})\s*\n/g)]
    .map((m) => m[1].trim())
    .filter((t) => t.length > 3 && !/^(menu|search|log ?in|sign ?up|business|creative center|tiktok)/i.test(t));
  return [...new Set(titles)].slice(0, 12);
}

// ---------------------------------------------------------------- link reader

async function firecrawlScrape(url: string, timeoutMs = 30000): Promise<{ markdown: string; title?: string } | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  const gateway = key.startsWith("lovc_");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (gateway) {
    const lk = process.env.LOVABLE_API_KEY;
    if (!lk) return null;
    headers.Authorization = `Bearer ${lk}`;
    headers["X-Connection-Api-Key"] = key;
  } else {
    headers.Authorization = `Bearer ${key}`;
  }
  const base = gateway ? "https://connector-gateway.lovable.dev/firecrawl/v2" : "https://api.firecrawl.dev/v2";
  try {
    const r = await fetch(`${base}/scrape`, {
      method: "POST",
      headers,
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, timeout: timeoutMs }),
    });
    if (!r.ok) {
      console.error(`[search] link reader ${r.status}`);
      return null;
    }
    const j: any = await r.json();
    const markdown = j?.markdown ?? j?.data?.markdown ?? "";
    const title = j?.metadata?.title ?? j?.data?.metadata?.title;
    if (!markdown) return null;
    return { markdown: markdown.slice(0, 14000), title };
  } catch (e) {
    console.error("[search] link reader failed:", (e as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------- synthesis

function synthesisSystem(dateCtx: string, extra?: string): string {
  return [
    `Today's date is ${dateCtx}. Treat every relative word (today, yesterday, latest, current, this week) against that real date.`,
    `Answer using ONLY the live results provided in the conversation. If the results do not contain the answer, say plainly that the available results don't cover it.`,
    `Cite facts with markdown links like [Title](URL) drawn from the provided results. Never fabricate links.`,
    `Never mention, name or hint at search providers, engines, tools, APIs or infrastructure. Write as Niza Prime AI.`,
    extra?.trim() || "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function synthesize(
  question: string,
  evidence: string,
  dateCtx: string,
  extraSystem?: string,
): Promise<string> {
  const messages = [
    { role: "user" as const, content: `Live results:\n\n${evidence}\n\nQuestion: ${question}` },
  ];
  return generateText(messages, synthesisSystem(dateCtx, extraSystem));
}

function evidenceFromResults(answer: string, results: WebSource[], contents: string[], max = 8): string {
  const lines: string[] = [];
  if (answer) lines.push(`Direct answer draft: ${answer}`);
  results.slice(0, max).forEach((r, i) => {
    const snippet = (contents[i] ?? "").replace(/\s+/g, " ").slice(0, 700);
    lines.push(`[${i + 1}] ${r.title} — ${r.url}\n${snippet}`);
  });
  return lines.join("\n\n");
}

// ---------------------------------------------------------------- URL helpers

export function youtubeId(url: string): string | null {
  const m = /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/i.exec(url);
  return m ? m[1] : null;
}

async function youtubeMeta(url: string): Promise<VideoResult | null> {
  const id = youtubeId(url);
  if (!id) return null;
  let title = "";
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`);
    if (r.ok) {
      const j: any = await r.json();
      title = j?.title ?? "";
    }
  } catch {
    /* title optional */
  }
  return { title: title || "YouTube video", url: `https://www.youtube.com/watch?v=${id}`, videoId: id, live: /\/live\//i.test(url) };
}

// ---------------------------------------------------------------- orchestrator

export async function runSearch(query: string, kind: SearchKind, extraSystem?: string): Promise<SearchResult> {
  const dateCtx = todayContext();
  try {
    if (kind === "video") return await videoSearch(query, dateCtx, extraSystem);
    if (kind === "image") return await imageSearch(query, dateCtx, extraSystem);
    if (kind === "trends") return await trendsSearch(query, dateCtx, extraSystem);
    return await textSearch(query, dateCtx, extraSystem);
  } catch (e) {
    console.error("[search] failed:", (e as Error).message);
    return { ok: false, error: ERR_TEXT };
  }
}

async function textSearch(query: string, dateCtx: string, extraSystem?: string): Promise<SearchResult> {
  const timeSensitive = /news|latest|today|current|price|rate|score|result|update|weather|happening|trend/i.test(query);
  const topics: Array<"news" | "general"> = timeSensitive ? ["news", "general"] : ["general"];

  for (const topic of topics) {
    const tv = await tavilySearch(query, { topic, maxResults: 8 });
    if (tv && tv.results.length) {
      const evidence = evidenceFromResults(tv.answer, tv.results, tv.contents);
      try {
        const text = await synthesize(query, evidence, dateCtx, extraSystem);
        return { ok: true, text, sources: tv.results.slice(0, 6), videos: [], images: [] };
      } catch (e) {
        console.error("[search] synthesis failed:", (e as Error).message);
      }
    }
  }

  const pplx = await perplexitySearch(query);
  if (pplx && pplx.length) {
    const evidence = pplx.map((r, i) => `[${i + 1}] ${r.title} — ${r.url}`).join("\n");
    try {
      const text = await synthesize(query, evidence, dateCtx, extraSystem);
      return { ok: true, text, sources: pplx.slice(0, 6), videos: [], images: [] };
    } catch (e) {
      console.error("[search] synthesis failed:", (e as Error).message);
    }
  }

  // Last live option: web-grounded answering. This is still a live search —
  // never the offline conversational model pretending to be current.
  const key = process.env.GeminichatAPI || process.env.GEMINI_API_KEY;
  if (key) {
    try {
      const j = await geminiCall(
        key,
        "gemini-2.5-flash",
        `${query}\n\nToday is ${dateCtx}. Answer using the latest information available and state the date of anything time-sensitive.`,
        [{ google_search: {} }],
      );
      const cand = j?.candidates?.[0];
      const text = cand?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
      const sources: WebSource[] = [];
      for (const c of cand?.groundingMetadata?.groundingChunks ?? []) {
        const w = c?.web;
        if (w?.uri && !sources.some((s) => s.url === w.uri)) sources.push({ title: w.title || w.uri, url: w.uri });
      }
      if (text) return { ok: true, text, sources: sources.slice(0, 5), videos: [], images: [] };
    } catch (e) {
      console.error("[search] grounded answer failed:", (e as Error).message);
    }
  }

  return { ok: false, error: ERR_TEXT };
}

async function imageSearch(query: string, dateCtx: string, extraSystem?: string): Promise<SearchResult> {
  const tv = await tavilySearch(query, { topic: "general", maxResults: 6, images: true });
  if (tv && (tv.images.length || tv.results.length)) {
    let text: string;
    try {
      text = tv.answer
        ? tv.answer
        : await synthesize(
            query,
            evidenceFromResults("", tv.results, tv.contents),
            dateCtx,
            `${extraSystem ?? ""}\nThe user asked for a real picture. Briefly describe what the real images below show in one or two sentences.`,
          );
    } catch {
      text = `Here are real images matching your request.`;
    }
    return { ok: true, text, sources: tv.results.slice(0, 6), videos: [], images: tv.images };
  }
  return { ok: false, error: ERR_IMAGE };
}

async function videoSearch(query: string, _dateCtx: string, _extraSystem?: string): Promise<SearchResult> {
  // A pasted YouTube link plays directly — no search needed.
  const pasted = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+/i.exec(query);
  if (pasted) {
    const v = await youtubeMeta(pasted[0]);
    if (v) {
      return {
        ok: true,
        text: v.live
          ? "Here's the live stream you shared. Press play below — if it can't play here, use the “Watch on YouTube” link."
          : "Here's the video you shared. Press play below — if it can't play here, use the “Watch on YouTube” link.",
        sources: [{ title: v.title, url: v.url }],
        videos: [v],
        images: [],
      };
    }
  }

  let videos = await videoEngineSearch(query);
  if (!videos.length) {
    const pplx = await perplexitySearch(`${query} site:youtube.com`);
    videos = (pplx ?? [])
      .filter((r) => /youtu\.be|youtube\.com/i.test(r.url))
      .map((r): VideoResult | null => {
        const id = youtubeId(r.url);
        return id
          ? { title: r.title, url: `https://www.youtube.com/watch?v=${id}`, videoId: id, live: /\blive\b/i.test(r.title) || /\/live\//i.test(r.url) }
          : null;
      })
      .filter((v): v is VideoResult => !!v);
  }
  if (!videos.length) {
    const tv = await tavilySearch(`${query} youtube`, { topic: "general", maxResults: 8 });
    videos = (tv?.results ?? [])
      .filter((r) => /youtu\.be|youtube\.com/i.test(r.url))
      .map((r): VideoResult | null => {
        const id = youtubeId(r.url);
        return id
          ? { title: r.title, url: `https://www.youtube.com/watch?v=${id}`, videoId: id, live: /\blive\b/i.test(r.title) || /\/live\//i.test(r.url) }
          : null;
      })
      .filter((v): v is VideoResult => !!v);
  }

  if (videos.length) {
    const sources: WebSource[] = videos.map((v) => ({ title: v.title, url: v.url }));
    const list = videos.map((v, i) => `${i + 1}. ${v.title}${v.live ? " (live)" : ""}`).join("\n");
    return {
      ok: true,
      text: `I found these videos for you. Press play to watch right here — if a video can't play inside the app, use its “Watch on YouTube” link.\n\n${list}`,
      sources,
      videos,
      images: [],
    };
  }
  return { ok: false, error: ERR_VIDEO };
}

async function trendsSearch(_query: string, dateCtx: string, _extraSystem?: string): Promise<SearchResult> {
  const [gt, tt] = await Promise.all([googleTrendsItems(), tiktokTrendsItems()]);
  const sources: WebSource[] = [
    { title: "Google Trends — daily trending searches", url: "https://trends.google.com/trends/trendingsearches/daily?geo=NG" },
    { title: "TikTok Creative Center — trending content", url: "https://ads.tiktok.com/business/creativecenter/pc/music?region=NG" },
  ];
  if (gt.length) {
    const evidence = [
      `Google Trends (most-searched right now):`,
      ...gt.map((t) => `- ${t.title}${t.traffic ? ` (~${t.traffic} searches)` : ""} [${t.geo}]`),
      tt.length ? `\nTrending sounds and music on short-video feeds:\n${tt.map((t) => `- ${t}`).join("\n")}` : "",
    ].join("\n");
    try {
      const text = await synthesize(
        "Summarise what is trending right now — top searches, and trending music, dances and topics on short-video feeds. Group by topic where natural, keep it scannable, and note that trends shift through the day.",
        evidence,
        dateCtx,
      );
      return { ok: true, text: `Here's what's trending right now (as of ${dateCtx}):\n\n${text}`, sources, videos: [], images: [] };
    } catch (e) {
      console.error("[search] trends synthesis failed:", (e as Error).message);
      const fallback = gt.slice(0, 12).map((t) => `- ${t.title}${t.traffic ? ` (~${t.traffic} searches)` : ""}`).join("\n");
      return { ok: true, text: `Here are the top trending searches right now (as of ${dateCtx}):\n\n${fallback}`, sources: sources.slice(0, 1), videos: [], images: [] };
    }
  }
  return { ok: false, error: ERR_TEXT };
}

/** Read a user-provided page and answer a question about it. */
export async function researchUrl(url: string, question: string, extraSystem?: string): Promise<SearchResult> {
  const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const page = await firecrawlScrape(safeUrl);
  if (!page) return { ok: false, error: ERR_LINK };
  const dateCtx = todayContext();
  const evidence = `Page: ${page.title ?? safeUrl}\nURL: ${safeUrl}\n\nContent:\n${page.markdown}`;
  try {
    const text = await synthesize(question, evidence, dateCtx, `${extraSystem ?? ""}\nBase your answer on the page content provided. Quote or summarise it faithfully; do not add outside claims.`);
    return { ok: true, text, sources: [{ title: page.title ?? safeUrl, url: safeUrl }], videos: [], images: [] };
  } catch (e) {
    console.error("[search] link synthesis failed:", (e as Error).message);
    return { ok: false, error: ERR_LINK };
  }
}
