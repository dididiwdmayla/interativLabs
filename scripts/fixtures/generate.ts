/**
 * Gera as cenas de teste (scenes/fixtures/<grupo>/) e os exemplos
 * (scenes/examples/). Determinístico: rodar de novo produz os mesmos arquivos.
 * Uso: npm run fixtures [-- calibracao,fixacoes]
 */
import { generateRoda } from "./roda";
import { generateMulticamada } from "./multicamada";
import { generateCalibracao } from "./calibracao";
import { generateDesempenho } from "./desempenho";
import { generateExemplos } from "./exemplos";
import { generateBancada } from "./bancada";
import { generateCiclo } from "./ciclo";
import { generateFixacoes } from "./fixacoes";
import { generateGas } from "./gas";
import { generateMolas } from "./molas";
import { generateRasgos } from "./rasgos";

const GROUPS: Record<string, () => void> = {
  roda: generateRoda,
  multicamada: generateMulticamada,
  calibracao: generateCalibracao,
  fixacoes: generateFixacoes,
  molas: generateMolas,
  rasgos: generateRasgos,
  gas: generateGas,
  ciclo: generateCiclo,
  exemplos: generateExemplos,
  bancada: generateBancada,
  desempenho: generateDesempenho,
};

export async function main(args: string[]) {
  const only = args[0]?.split(",");
  for (const [name, gen] of Object.entries(GROUPS)) if (!only || only.includes(name)) gen();
}
