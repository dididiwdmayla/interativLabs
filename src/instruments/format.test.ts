import { expect, it } from "vitest";
import { formatNumber, formatValue } from "./format";

it("writes numbers the Brazilian way: comma decimal, dot thousands, at most two decimals", () => {
  expect(formatNumber(10.9632808761178)).toBe("10,96");
  expect(formatNumber(4292.8)).toBe("4.292,8");
  expect(formatNumber(9.78)).toBe("9,78");
  expect(formatNumber(0.3)).toBe("0,3");
  expect(formatNumber(1234567.891)).toBe("1.234.567,89");
  expect(formatNumber(15)).toBe("15");
  expect(formatNumber(-1.65)).toBe("-1,65");
  expect(formatNumber(-0.000001)).toBe("0");
  expect(formatNumber(1000)).toBe("1.000");
  expect(formatNumber(0.05, 3)).toBe("0,05");
});
it("small values keep their significant digits instead of rounding to zero", () => {
  expect(formatNumber(0.017285)).toBe("0,0173");
  expect(formatNumber(-0.0173)).toBe("-0,0173");
  expect(formatNumber(0.0499)).toBe("0,0499");
  expect(formatNumber(0.05)).toBe("0,05");
  expect(formatNumber(0.00123)).toBe("0,00123");
  expect(formatNumber(0.000001)).toBe("0");
  expect(formatNumber(0.1)).toBe("0,1");
});
it("shows a dash for no reading and never a dot decimal", () => {
  expect(formatNumber(null)).toBe("—");
  expect(formatNumber(undefined)).toBe("—");
  expect(formatNumber(Number.NaN)).toBe("—");
  expect(formatValue(null, "mm")).toBe("—");
  expect(formatValue(10.589, "m/s")).toBe("10,59 m/s");
  for (const v of [0.5, 12.34, 4292.85, -9.78, 1e5 + 0.25])
    expect(formatNumber(v)).not.toMatch(/\d\.\d{1,2}$/);
});
