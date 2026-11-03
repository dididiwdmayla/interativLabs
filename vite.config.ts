/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    // public/assets/<grupo> é do pipeline de assets; o bundle fica em /_app.
    assetsDir: "_app",
  },
  test: {
    include: ["src/**/*.test.ts", "scenes/**/*.test.ts"],
    environment: "node",
  },
});
