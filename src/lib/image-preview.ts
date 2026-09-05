import type { AspectRatio } from "./router-kb";

export type ImagePreviewSpec = {
  width: number;
  height: number;
  cssAspectRatio: `${number} / ${number}`;
};

/** Target chat-preview bounds. Width is a maximum; the frame remains fluid. */
export const IMAGE_PREVIEW_SPECS: Record<AspectRatio, ImagePreviewSpec> = {
  "1:1": { width: 320, height: 320, cssAspectRatio: "1 / 1" },
  "16:9": { width: 320, height: 180, cssAspectRatio: "16 / 9" },
  "4:3": { width: 320, height: 240, cssAspectRatio: "4 / 3" },
  "3:4": { width: 320, height: 427, cssAspectRatio: "3 / 4" },
  "4:5": { width: 320, height: 400, cssAspectRatio: "4 / 5" },
  "9:16": { width: 270, height: 480, cssAspectRatio: "9 / 16" },
};

export function getImagePreviewSpec(ratio: AspectRatio = "1:1"): ImagePreviewSpec {
  return IMAGE_PREVIEW_SPECS[ratio] ?? IMAGE_PREVIEW_SPECS["1:1"];
}