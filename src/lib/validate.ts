/**
 * Validasi runtime untuk server functions.
 * Validator `.validator((d) => d)` hanya memberi tipe TypeScript —
 * data dari client tetap harus dibatasi di sini sebelum dipakai.
 */

export const MAX_SEARCH_LENGTH = 100;
export const MAX_REASON_LENGTH = 1000;
export const MAX_KETERANGAN_LENGTH = 500;
export const MAX_NOMINAL = 100_000_000;

export function assertSearch(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("Pencarian tidak valid");
  const trimmed = value.trim();
  if (trimmed.length > MAX_SEARCH_LENGTH) {
    throw new Error(`Pencarian maksimal ${MAX_SEARCH_LENGTH} karakter`);
  }
  return trimmed || undefined;
}

export function assertReason(value: unknown, field = "Alasan"): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} wajib diisi`);
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_REASON_LENGTH) {
    throw new Error(`${field} maksimal ${MAX_REASON_LENGTH} karakter`);
  }
  return trimmed;
}

export function assertKeterangan(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Keterangan wajib diisi");
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_KETERANGAN_LENGTH) {
    throw new Error(`Keterangan maksimal ${MAX_KETERANGAN_LENGTH} karakter`);
  }
  return trimmed;
}

export function assertNominal(value: unknown, field = "Nominal"): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} harus bilangan bulat positif`);
  }
  if (value > MAX_NOMINAL) {
    throw new Error(`${field} melebihi batas wajar`);
  }
  return value;
}

export function assertNominalKas(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("Nominal kas harus bilangan bulat >= 0");
  }
  if (value > MAX_NOMINAL) {
    throw new Error("Nominal kas melebihi batas wajar");
  }
  return value;
}

export function assertDateString(value: unknown, field = "Tanggal"): Date {
  if (typeof value !== "string" || !value) throw new Error(`${field} tidak valid`);
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) throw new Error(`${field} tidak valid`);
  return t;
}

export function assertOptionalDateString(
  value: unknown,
  field = "Tanggal",
): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return assertDateString(value, field);
}

export function assertEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new Error(`${field} tidak valid`);
  }
  return value as T;
}

/** Batas hasil query agar halaman tidak memuat seluruh tabel ke memori. */
export const MAX_LIST_ROWS = 2000;

export function assertLimit(value: unknown, def = 100, max = 300): number {
  if (value === undefined || value === null) return def;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error("Limit tidak valid");
  }
  return Math.min(value, max);
}
