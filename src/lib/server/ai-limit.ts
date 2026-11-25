import { sql } from "drizzle-orm";
import { db } from "@/db";
import { aiRateLimit } from "@/db/kas-schema";

/**
 * Kuota chatbot AI. Free tier Gemini membatasi jumlah request, jadi hitungan
 * disimpan di Postgres (bukan memori) agar aman di banyak instance serverless.
 * "pending 5 menit" = jendela tetap: lewat batas → tunggu jendela berikutnya.
 */

const WINDOW_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function envInt(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const AI_USER_PER_WINDOW = envInt("AI_USER_PER_5MIN", 10);
export const AI_GLOBAL_PER_DAY = envInt("AI_GLOBAL_PER_DAY", 80);

export type AiSlot =
    | { ok: true }
    | { ok: false; retryAfterSeconds: number };

async function bump(key: string, windowStart: Date) {
    const [row] = await db
        .insert(aiRateLimit)
        .values({ key, windowStart, count: 1 })
        .onConflictDoUpdate({
            target: aiRateLimit.key,
            set: {
                count: sql`CASE WHEN ${aiRateLimit.windowStart} = ${windowStart}
                    THEN ${aiRateLimit.count} + 1 ELSE 1 END`,
                windowStart,
            },
        })
        .returning({ count: aiRateLimit.count });
    return row?.count ?? 1;
}

export async function takeAiSlot(userId: string): Promise<AiSlot> {
    const now = Date.now();
    const userWindow = new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS);
    const day = new Date(now);
    day.setUTCHours(0, 0, 0, 0);

    if ((await bump(`u:${userId}:5m`, userWindow)) > AI_USER_PER_WINDOW) {
        return {
            ok: false,
            retryAfterSeconds: Math.ceil(
                (userWindow.getTime() + WINDOW_MS - now) / 1000,
            ),
        };
    }

    if ((await bump("global:day", day)) > AI_GLOBAL_PER_DAY) {
        return {
            ok: false,
            retryAfterSeconds: Math.ceil((day.getTime() + DAY_MS - now) / 1000),
        };
    }

    return { ok: true };
}
