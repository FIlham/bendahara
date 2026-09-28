import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { desc, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import {
  activityLog,
  cashEntry,
  kasPeriode,
  kasSetting,
  ledgerEntry,
  DEFAULT_NOMINAL_KAS,
  NOMINAL_KAS_KEY,
} from "@/db/kas-schema";
import { ensureKasDefaults } from "@/lib/kas-seed";
import { compareByNim } from "@/lib/nim";
import { assertReason } from "@/lib/validate";
import type { LogChanges } from "@/lib/kas.functions";

async function requireSession() {
  const session = await auth.api.getSession({
    headers: getRequestHeaders(),
  });
  if (!session) throw new Error("Unauthorized");
  return session;
}

async function requireBendahara() {
  const session = await requireSession();
  const role = (session.user as { role?: string }).role ?? "user";
  if (role !== "bendahara") throw new Error("Forbidden");
  return session;
}

export interface PeriodeInfo {
  id: string;
  nomor: number;
  nominal: number;
  status: string;
  openedAt: Date;
  closedAt: Date | null;
}

export const listPeriodes = createServerFn({ method: "GET" }).handler(
  async (): Promise<PeriodeInfo[]> => {
    const session = await requireSession();
    // DB fresh (habis migrate): seed Periode 1 + setting default.
    await ensureKasDefaults(session.user.id);
    return db.select().from(kasPeriode).orderBy(desc(kasPeriode.nomor));
  },
);

export const getActivePeriode = createServerFn({ method: "GET" }).handler(
  async (): Promise<PeriodeInfo | null> => {
    const session = await requireSession();
    const [row] = await db
      .select()
      .from(kasPeriode)
      .where(eq(kasPeriode.status, "aktif"))
      .limit(1);
    if (row) return row;
    // DB fresh (habis migrate): seed Periode 1 + setting default.
    const { active } = await ensureKasDefaults(session.user.id);
    return active;
  },
);

export interface PeriodeSnapshot {
  nomor: number;
  nominal: number;
  totalMasuk: number;
  totalKeluar: number;
  ekspektasi: number;
  userCount: number;
  perUser: {
    id: string;
    name: string;
    kurang: number;
    lunas: number;
    total: number;
  }[];
  closedAt: string;
}

export const closeAndOpenPeriode = createServerFn({ method: "POST" })
  .validator((d: { reason: string }) => d)
  .handler(async ({ data }) => {
    const session = await requireBendahara();
    const reason = assertReason(data.reason);

    return db.transaction(async (tx) => {
      // Kunci baris periode aktif agar dua penutupan bersamaan tidak
      // bisa membuat dua periode aktif (didukung juga oleh partial
      // unique index kas_periode_single_active di database).
      const locked = await tx.execute(
        sql`SELECT * FROM ${kasPeriode} WHERE status = 'aktif' LIMIT 1 FOR UPDATE`,
      );
      const active = (locked.rows[0] as unknown as typeof kasPeriode.$inferSelect | undefined) as
        | typeof kasPeriode.$inferSelect
        | undefined;

      if (!active) {
        // Fresh DB: just open Periode 1.
        const [s] = await tx
          .select()
          .from(kasSetting)
          .where(eq(kasSetting.key, NOMINAL_KAS_KEY))
          .limit(1);
        if (!s) {
          await tx
            .insert(kasSetting)
            .values({
              key: NOMINAL_KAS_KEY,
              value: DEFAULT_NOMINAL_KAS,
              updatedBy: session.user.id,
            })
            .onConflictDoNothing();
        }
        const [p1] = await tx
          .insert(kasPeriode)
          .values({
            id: crypto.randomUUID(),
            nomor: 1,
            nominal: s?.value ?? DEFAULT_NOMINAL_KAS,
            status: "aktif",
            openedBy: session.user.id,
          })
          .returning();
        return p1;
      }

      // Snapshot rekap periode yang ditutup.
      const [sums] = await tx
        .select({
          masuk: sql<number>`coalesce(sum(${ledgerEntry.debit}), 0)`,
          keluar: sql<number>`coalesce(sum(${ledgerEntry.kredit}), 0)`,
        })
        .from(ledgerEntry)
        .where(eq(ledgerEntry.periodeId, active.id));
      const allUsers = await tx
        .select({ id: user.id, name: user.name, createdAt: user.createdAt })
        .from(user);
      const paidRows = await tx
        .select({
          depositorUserId: cashEntry.depositorUserId,
          amount: cashEntry.amount,
          periodeId: cashEntry.periodeId,
        })
        .from(cashEntry)
        .where(eq(cashEntry.periodeId, active.id));
      // Status per user direset tiap periode: hanya setoran minggu ini yang dihitung.
      const paidByUser = new Map<string, number>();
      for (const r of paidRows) {
        paidByUser.set(
          r.depositorUserId,
          (paidByUser.get(r.depositorUserId) ?? 0) + r.amount,
        );
      }
      const perUser = allUsers
        .map((u) => {
          const paid = paidByUser.get(u.id) ?? 0;
          return {
            id: u.id,
            name: u.name,
            kurang: Math.max(0, active.nominal - paid),
            lunas: paid >= active.nominal ? 1 : 0,
            total: 1,
          };
        })
        .sort(compareByNim);

      const snapshot: PeriodeSnapshot = {
        nomor: active.nomor,
        nominal: active.nominal,
        totalMasuk: Number(sums?.masuk ?? 0),
        totalKeluar: Number(sums?.keluar ?? 0),
        ekspektasi: active.nominal * allUsers.length,
        userCount: allUsers.length,
        perUser,
        closedAt: new Date().toISOString(),
      };

      await tx
        .update(kasPeriode)
        .set({
          status: "arsip",
          closedBy: session.user.id,
          closedAt: new Date(),
          snapshot: JSON.stringify(snapshot),
        })
        .where(eq(kasPeriode.id, active.id));

      const [next] = await tx
        .insert(kasPeriode)
        .values({
          id: crypto.randomUUID(),
          nomor: active.nomor + 1,
          nominal: active.nominal,
          status: "aktif",
          openedBy: session.user.id,
        })
        .returning();

      await tx.insert(activityLog).values({
        id: crypto.randomUUID(),
        actorId: session.user.id,
        action: "update",
        entity: "periode",
        entityId: next.id,
        changes: JSON.stringify({
          periode: { old: active.nomor, new: next.nomor },
        } satisfies LogChanges),
        reason,
      });
      return next;
    });
  });
