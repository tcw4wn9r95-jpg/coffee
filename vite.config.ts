import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Project is served from https://<user>.github.io/coffee/
const BASE = "/coffee/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon-180.png", "favicon-32.png"],
      manifest: {
        name: "Bruna — Coffee Dial-In",
        short_name: "Bruna",
        description:
          "A warm, Nordic espresso companion. Photograph a coffee, get gear-tuned settings, dial in by taste, and remember what works.",
        theme_color: "#B4693E",
        background_color: "#F4EFE6",
        display: "standalone",
        orientation: "portrait",
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Never cache calls to the Anthropic API.
        navigateFallbackDenylist: [/^https:\/\/api\.anthropic\.com/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.anthropic\.com\/.*/i,
            handler: "NetworkOnly",
            method: "POST",
          },
        ],
      },
    }),
  ],
});
