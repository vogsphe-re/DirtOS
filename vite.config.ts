import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-vite-plugin";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
  plugins: [tanstackRouter(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "node:fs/promises": path.resolve(__dirname, "./src/lib/shims/nodeFsPromises.ts"),
      "node:url": path.resolve(__dirname, "./src/lib/shims/nodeUrl.ts"),
    },
  },
  build: {
    chunkSizeWarningLimit: 768, // 768kb is the max size for a single file on Tauri's WebView2 (https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/app-size-limits#javascript-file-size-limit)
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("/react-dom/") ||
              (id.includes("/react/") &&
                !id.includes("/react-three/") &&
                !id.includes("/react-konva"))
            )
              return "vendor-react";
            if (id.includes("/@mantine/")) return "vendor-mantine";
            if (id.includes("/three/")) return "vendor-three-core";
            if (id.includes("/@react-three/fiber/") || id.includes("/@react-three/drei/"))
              return "vendor-three-react";
            if (id.includes("/suncalc/")) return "vendor-garden3d-utils";
            if (id.includes("/recharts/")) return "vendor-charts";
            if (id.includes("/konva/") || id.includes("/react-konva/")) return "vendor-canvas";
            if (id.includes("/@tanstack/")) return "vendor-router";
          }
        },
      },
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
