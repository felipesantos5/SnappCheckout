import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
// import { optimizePlugin } from "./vite-plugin-optimize";
import { compression } from "vite-plugin-compression2";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
    cssInjectedByJsPlugin(),
    compression({
      algorithms: ["gzip", "brotliCompress"], // Gera .gz e .br ao mesmo tempo
      exclude: [/\.(br)$/, /\.(gz)$/], // Evita comprimir o que já está comprimido
    }),
    // optimizePlugin(), // Adicione se estiver usando o plugin que mostrou
  ],
  build: {
    cssCodeSplit: false,
    minify: "esbuild",
    target: "es2020",
    reportCompressedSize: false,
    rollupOptions: {
      treeshake: {
        preset: "recommended",
        moduleSideEffects: "no-external",
      },
      output: {
        // CORREÇÃO AQUI: Estratégia simplificada para evitar o erro de createContext
        manualChunks(id) {
          // Mantém React, Router e DOM juntos para garantir inicialização correta
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react-router-dom") ||
            id.includes("node_modules/@remix-run")
          ) {
            // Router v7 usa remix-run internamente às vezes
            return "react-vendor";
          }

          // Separa Stripe pois é grande e raramente muda
          if (id.includes("@stripe")) {
            return "stripe";
          }

          // UI libs (Radix, Lucide) podem ficar juntas ou separadas
          if (id.includes("@radix-ui") || id.includes("lucide-react")) {
            return "ui-vendor";
          }

          // O resto vai para vendor genérico
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
        assetFileNames: (assetInfo) => {
          if (!assetInfo.name) return "assets/[name]-[hash][extname]";
          const info = assetInfo.name.split(".");
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/css/i.test(ext)) {
            return `assets/css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    host: true,
  },
});
