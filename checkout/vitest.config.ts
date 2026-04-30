import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.tsx"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
    css: true,
    env: {
      VITE_BACKEND_URL: "http://localhost:4242",
      VITE_STRIPE_PUBLISHABLE_KEY: "pk_test_checkout",
    },
  },
});
