/**
 * Resultado das operações de geometria. Nenhuma função de src/geometry lança
 * exceção por causa de entrada do usuário: ou devolve o valor (com avisos em
 * português) ou um erro tipado.
 */

export type GeoErrorCode = "too-small" | "empty" | "invalid" | "internal";

export interface GeoError {
  code: GeoErrorCode;
  message: string;
}

export type GeoResult<T> = { ok: true; value: T; warnings: string[] } | { ok: false; error: GeoError };

export function ok<T>(value: T, warnings: string[] = []): GeoResult<T> {
  return { ok: true, value, warnings };
}

export function fail<T>(code: GeoErrorCode, message: string): GeoResult<T> {
  return { ok: false, error: { code, message } };
}

/** Formata mm² ou mm com vírgula decimal (texto de interface). */
export function fmt(n: number, digits = 2): string {
  return n.toFixed(digits).replace(".", ",");
}
