/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Só no build do navegador: o caminho Node do box2d3-wasm nunca roda lá.
      ...(command === "build"
        ? { "node:module": fileURLToPath(new URL("./src/engine/box2d/node-module-stub.ts", import.meta.url)) }
        : {}),
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    // public/assets/<grupo> é do pipeline de assets; o bundle fica em /_app.
    assetsDir: "_app",
    // Os motores (WASM incluso) são grandes por natureza e só carregam na bancada.
    chunkSizeWarningLimit: 2600,
  },
  // Worker em módulo ES: cada motor vira um pedaço carregado sob demanda, com
  // nome próprio (engine-*) para o tamanho ser medido no build.
  worker: {
    format: "es",
    rollupOptions: {
      output: {
        chunkFileNames: (chunk: { name: string; moduleIds: string[] }) => {
          const ids = chunk.moduleIds.join("\n");
          const name = ids.includes("rapier2d-deterministic-compat")
            ? "engine-rapier-det"
            : ids.includes("rapier2d-compat")
              ? "engine-rapier"
              : ids.includes("box2d3-wasm")
                ? "engine-box2d"
                : ids.includes("/planck/")
                  ? "engine-planck"
                  : chunk.name;
          return `_app/${name}-[hash].js`;
        },
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scenes/**/*.test.ts"],
    environment: "node",
    testTimeout: 120_000,
  },
}));
