import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  DEFAULT_NOMINAL_KAS,
  NOMINAL_KAS_KEY,
  kasPeriode,
  kasSetting,
} from "@/db/kas-schema";

/**
 * Fallback untuk DB fresh (habis migrate): pastikan ada setting nominal
 * dan satu periode aktif.
 *
 * - kas_setting: `{ key: nominal_kas, value: 5000 }`
 * - kas_periode: nomor 1, nominal 5000, status "aktif", openedAt sekarang
 *   (default kolom), openedBy = user yang pertama memicu seed.
 *
 * Idempoten dan aman dipanggil dari read path maupun write path;
 * race antar request ditangani via `onConflictDoNothing` + baca ulang.
 */
export async function ensureKasDefaults(actorId: string) {
  let [setting] = await db
    .select()
    .from(kasSetting)
    .where(eq(kasSetting.key, NOMINAL_KAS_KEY))
    .limit(1);
  if (!setting) {
    const [inserted] = await db
      .insert(kasSetting)
      .values({
        key: NOMINAL_KAS_KEY,
        value: DEFAULT_NOMINAL_KAS,
        updatedBy: actorId,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted) {
      setting = inserted;
    } else {
      const [retry] = await db
        .select()
        .from(kasSetting)
        .where(eq(kasSetting.key, NOMINAL_KAS_KEY))
        .limit(1);
      if (retry) setting = retry;
    }
  }
  const nominal = setting?.value ?? DEFAULT_NOMINAL_KAS;

  let [active] = await db
    .select()
    .from(kasPeriode)
    .where(eq(kasPeriode.status, "aktif"))
    .limit(1);
  if (!active) {
    const [created] = await db
      .insert(kasPeriode)
      .values({
        id: crypto.randomUUID(),
        nomor: 1,
        nominal,
        status: "aktif",
        openedBy: actorId,
      })
      .onConflictDoNothing()
      .returning();
    if (created) {
      active = created;
    } else {
      const [retry] = await db
        .select()
        .from(kasPeriode)
        .where(eq(kasPeriode.status, "aktif"))
        .limit(1);
      if (retry) active = retry;
    }
  }
  return { active: active ?? null, nominal };
}
