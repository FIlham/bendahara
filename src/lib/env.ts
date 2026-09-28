/**
 * Validasi environment wajib saat startup.
 * Dipakai di server (db/auth) agar deploy yang lupa set env
 * gagal dengan pesan jelas, bukan error samar dari driver/OAuth.
 */

const REQUIRED = [
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "DATABASE_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "QRIS_URL"
] as const;

type RequiredKey = (typeof REQUIRED)[number];

const cache = new Map<string, string>();

export function getEnv(key: RequiredKey): string {
    const cached = cache.get(key);
    if (cached) return cached;
    const value = process.env[key];
    if (!value) {
        throw new Error(
            `[env] ${key} belum diset. ` +
            `Tambahkan di environment Vercel (Production/Preview) ` +
            `dan pastikan callback Google = {BETTER_AUTH_URL}/api/auth/callback/google.`,
        );
    }
    cache.set(key, value);
    return value;
}

/** Panggil sekali saat server boot untuk gagal cepat bila env kurang. */
export function assertServerEnv(): void {
    for (const key of REQUIRED) getEnv(key);
}
