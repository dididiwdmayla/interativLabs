/**
 * Roda um script TypeScript do projeto no Node, com o alias @/ e os imports
 * de JSON do Vite (servidor em modo middleware + module runner).
 * Uso: node scripts/run-ts.mjs caminho/do/script.ts [args]
 * O script exporta `main(args: string[])`.
 */
import { resolve } from "node:path";
import { createServer, createServerModuleRunner } from "vite";

const [, , file, ...args] = process.argv;
if (!file) {
  console.error("Uso: node scripts/run-ts.mjs <script.ts> [args]");
  process.exit(1);
}
const server = await createServer({
  configFile: false,
  appType: "custom",
  logLevel: "warn",
  server: { middlewareMode: true, hmr: false, ws: false },
  resolve: { alias: { "@": resolve("src") } },
});
const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
let code = 0;
try {
  const mod = await runner.import(resolve(file));
  if (typeof mod.main !== "function") throw new Error(`${file} não exporta main()`);
  await mod.main(args);
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  await runner.close();
  await server.close();
}
process.exit(code);
