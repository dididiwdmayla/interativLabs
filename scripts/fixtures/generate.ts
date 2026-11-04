/**
 * Gera as cenas de teste (scenes/fixtures/<grupo>/) e os exemplos
 * (scenes/examples/). Determinístico: rodar de novo produz os mesmos arquivos.
 * Uso: npm run fixtures [-- calibracao,fixacoes]
 */
import { generateCalibracao } from "./calibracao";
import { generateFixacoes } from "./fixacoes";
import { generateGas } from "./gas";
import { generateMolas } from "./molas";
import { generateRasgos } from "./rasgos";

const GROUPS: Record<string, () => void> = {
  calibracao: generateCalibracao,
  fixacoes: generateFixacoes,
  molas: generateMolas,
  rasgos: generateRasgos,
  gas: generateGas,
};

export async function main(args: string[]) {
  const only = args[0]?.split(",");
  for (const [name, gen] of Object.entries(GROUPS)) if (!only || only.includes(name)) gen();
}
