/**
 * NIM helpers (pure — safe to import anywhere).
 * NIM disimpan sebagai string di `user.id` (kompatibilitas better-auth +
 * postgres), sehingga pengurutan harus numerik bila isinya angka.
 */

/** Nilai numerik NIM, atau null bila id bukan angka murni. */
export function nimValue(id: string): number | null {
  if (!/^\d+$/.test(id)) return null;
  const n = Number(id);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Urutan low-to-high berdasarkan NIM numerik.
 * Id non-angka diletakkan paling belakang, tiebreak alfabetis nama.
 */
export function compareByNim(
  a: { id: string; name: string },
  b: { id: string; name: string },
): number {
  const na = nimValue(a.id);
  const nb = nimValue(b.id);
  if (na !== null && nb !== null) {
    return na - nb || a.name.localeCompare(b.name, "id");
  }
  if (na !== null) return -1;
  if (nb !== null) return 1;
  return a.name.localeCompare(b.name, "id");
}
