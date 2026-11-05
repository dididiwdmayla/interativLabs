import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import { reactRefresh } from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist", "reference", "node_modules", "test-results", "playwright-report"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strict,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite(),
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser },
    },
  },
  {
    files: ["src/model/**", "src/geometry/**", "src/engine/**", "src/sim/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "react/*", "@/ui/*", "@/render/*", "@/editor/*"],
              message: "Módulo de domínio: sem React nem DOM.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "tests/**"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
  {
    // Código numérico (polígonos, laços de passo): índices calculados dentro do
    // próprio laço. Com noUncheckedIndexedAccess, cada acesso já passa por `!`
    // explícito, e um helper com checagem custaria caro no passo de física.
    files: [
      "src/geometry/**",
      "src/engine/**",
      "src/bench/**",
      "src/sim/**",
      "src/render/**",
      "src/parts/**",
      "scripts/**",
    ],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
  {
    files: ["*.config.ts", "tests/**", "scripts/**"],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
]);
