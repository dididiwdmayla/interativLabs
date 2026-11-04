/**
 * O box2d3-wasm só importa `node:module` quando roda no Node. No pacote do
 * navegador esse import nunca executa; este módulo vazio evita o aviso do Vite.
 */
export function createRequire(): never {
  throw new Error("node:module não existe no navegador");
}
