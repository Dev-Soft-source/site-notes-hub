import path from "path";
import { defineConfig } from "vitest/config";

/** Vitest bundles TS via esbuild; no Vite React plugin needed until component tests use JSX. */
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
