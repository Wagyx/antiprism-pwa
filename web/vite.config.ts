import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["wasm/antiprism.wasm", "wasm/antiprism.data", "wasm/antiprism.js"],
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
            src: "/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
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
