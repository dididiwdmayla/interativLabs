/**
 * Numbers on the instruments, in pt-BR: comma for decimals, dot for thousands, "—" for no reading.
 * Done by hand rather than with `toLocaleString`, so the text is the same in every browser, in the
 * worker, in Node and in the tests, whatever locale data the runtime ships.
 */
export function formatNumber(value: number | null | undefined, digits?: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  // two decimals, and three significant digits below 0,1, so a 0,017 N·mm torque does not read as 0
  const abs = Math.abs(value);
  const places = digits ?? (abs >= 0.1 || abs === 0 ? 2 : Math.min(5, 2 - Math.floor(Math.log10(abs))));
  const fixed = Math.abs(value).toFixed(places);
  const [whole = "0", fraction = ""] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimals = fraction.replace(/0+$/, "");
  const text = decimals ? `${grouped},${decimals}` : grouped;
  // a value that rounds to zero has no sign
  return value < 0 && /[1-9]/.test(fixed) ? `-${text}` : text;
}

/** A value with its unit, e.g. "10,96 m/s". */
export function formatValue(value: number | null | undefined, unit: string, digits?: number): string {
  return value === null || value === undefined ? "—" : `${formatNumber(value, digits)} ${unit}`;
}
