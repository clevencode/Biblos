import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { notionFlashcardPlugin } from "./vite.notion.ts";

export default defineConfig(({ mode }) => ({
  base: "/",
  plugins: [
    react(),
    notionFlashcardPlugin(mode),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "favicon.png", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Biblos",
        short_name: "Biblos",
        description: "Flashcards bibliques et plan de lecture",
        theme_color: "#FFFFFF",
        background_color: "#FFFFFF",
        display: "standalone",
        orientation: "portrait-primary",
        lang: "fr",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
  },
}));
