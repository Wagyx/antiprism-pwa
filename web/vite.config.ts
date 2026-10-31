import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "favicon.png",
        "wasm/antiprism.wasm",
        "wasm/antiprism.data",
        "wasm/antiprism.js",
      ],
      manifest: {
        name: "Antiprism GUI",
        short_name: "Antiprism",
        description: "Offline polyhedra generator and viewer powered by Antiprism Wasm",
        theme_color: "#1a2332",
        background_color: "#1a2332",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/favicon.png",
            sizes: "128x128",
            type: "image/png",
          },
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,wasm,data}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: "/index.html",
      },
      // Keep the SW out of `vite dev` — it fights HMR and can look like a UI blink loop.
      devOptions: {
        enabled: false,
      },
    }),
  ],
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: [],
  },
});
