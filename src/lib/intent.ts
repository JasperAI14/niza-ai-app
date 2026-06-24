// Detect whether a user message is requesting an image.
// Returns the cleaned image prompt if so, otherwise null.
const VERB_PATTERNS = [
  /\b(generate|create|make|draw|paint|design|render|produce|sketch|compose|give\s+me)\s+(?:me\s+)?(?:an?\s+|some\s+|a\s+couple\s+of\s+|two\s+|2\s+)?(image|images|picture|pictures|photo|photos|pic|pics|illustration|illustrations|drawing|drawings|painting|paintings|artwork|art|logo|logos|wallpaper|wallpapers|poster|posters|sketch|render|portrait|scene|icon|icons|graphic|graphics|banner|thumbnail|avatar|mockup)\b/i,
  /\b(imagine|visuali[sz]e)\b/i,
  /\b(?:an?|the|some)\s+(image|picture|photo|illustration|drawing|painting|artwork|logo|poster|sketch|render|portrait|scene|graphic|banner|wallpaper|mockup)\s+(of|showing|depicting|with|featuring)\b/i,
  /\b(show|draw|paint)\s+me\s+(?:an?\s+|a\s+)?(image|picture|photo|pic|illustration|drawing|scene|portrait)\b/i,
  /\b(picture|photo|image|illustration|drawing|painting|art|logo|wallpaper|poster)\s+of\s+/i,
  /^\s*(draw|paint|sketch|illustrate|render)\s+/i,
];

export function detectImageRequest(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  for (const re of VERB_PATTERNS) {
    if (re.test(t)) return t;
  }
  return null;
}
