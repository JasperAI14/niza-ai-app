// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        includeAssets: [
          "favicon.ico",
          "icon-192.png",
          "icon-512.png",
          "icon-maskable-192.png",
          "icon-maskable-512.png",
          "screenshot-mobile.png",
          "screenshot-desktop.png",
          "sw-extras.js",
        ],
        manifest: false, // we ship public/manifest.webmanifest
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
          importScripts: ["/sw-extras.js"],
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/_serverFn/, /^\/api/, /^\/~oauth/, /^\/auth/],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: { cacheName: "html-cache", networkTimeoutSeconds: 5 },
            },
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin && ["style", "script", "worker", "font"].includes(request.destination),
              handler: "StaleWhileRevalidate",
              options: { cacheName: "asset-cache" },
            },
            {
              urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === "image",
              handler: "CacheFirst",
              options: {
                cacheName: "image-cache",
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});
