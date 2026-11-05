/** "12,5" com vírgula; inteiros sem casas. */
export function fmt(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "";
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return r.toLocaleString("pt-BR", { maximumFractionDigits: digits, useGrouping: false });
}

/** "12,5" ou "12.5" → 12.5 (NaN se não for número). */
export function parseNum(s: string): number {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  return t === "" || t === "-" ? NaN : Number(t);
}
