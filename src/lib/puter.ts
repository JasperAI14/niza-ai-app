// Browser-only Puter integration for Niza Premium image generation.
// Each Niza user links their own Puter account; the link is verified server-side.
declare global {
  interface Window {
    puter?: any;
  }
}

const IMAGE_SIZES: Record<string, { w: number; h: number }> = {
  "1:1": { w: 1024, h: 1024 },
  "3:4": { w: 896, h: 1152 },
  "4:5": { w: 896, h: 1152 },
  "9:16": { w: 768, h: 1344 },
  "4:3": { w: 1152, h: 896 },
  "16:9": { w: 1344, h: 768 },
};

let loader: Promise<any> | null = null;
export function loadPuter(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser only"));
  if (window.puter) return Promise.resolve(window.puter);
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://js.puter.com/v2/";
      s.async = true;
      s.onload = () => (window.puter ? resolve(window.puter) : reject(new Error("Puter failed to load")));
      s.onerror = () => {
        loader = null;
        reject(new Error("Could not reach Puter. Check your connection."));
      };
      document.head.appendChild(s);
    });
  }
  return loader;
}

export async function puterSession(): Promise<{ username: string; token: string } | null> {
  const p = await loadPuter();
  if (!p.auth.isSignedIn()) return null;
  const u = await p.auth.getUser();
  return { username: u?.username, token: p.authToken };
}

/** Must be called from a user click (opens Puter's sign-in popup). */
export async function puterSignIn(): Promise<{ username: string; token: string }> {
  const p = await loadPuter();
  if (p.auth.isSignedIn()) p.auth.signOut();
  await p.auth.signIn();
  const s = await puterSession();
  if (!s) throw new Error("Puter sign-in was not completed.");
  return s;
}

export async function puterGenerateImage(prompt: string, ratio: string): Promise<string> {
  const p = await loadPuter();
  const size = IMAGE_SIZES[ratio] ?? IMAGE_SIZES["1:1"];
  const shaped = `${prompt}\n\nCompose for a ${ratio} frame (${size.w}x${size.h}).`;
  let img: HTMLImageElement;
  try {
    img = await p.ai.txt2img(shaped, { width: size.w, height: size.h });
  } catch (e: any) {
    const msg = String(e?.message ?? e?.error?.message ?? e ?? "");
    if (/limit|quota|insufficient|funds|credit|429/i.test(msg))
      throw new Error("Image generation isn't available on your connected account right now. Please try again later.");
    throw new Error("The image service is unavailable right now. Please retry in a moment.");
  }
  const src = img?.src;
  if (!src) throw new Error("No image was returned. Please retry.");
  if (src.startsWith("data:")) return src;
  const blob = await (await fetch(src)).blob();
  return await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}
