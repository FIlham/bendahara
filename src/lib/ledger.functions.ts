import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import {
  LEDGER_METHODS,
  LEDGER_TIPES,
  activityLog,
  kasPeriode,
  ledgerEntry,
  type LedgerMethod,
  type LedgerTipe,
} from "@/db/kas-schema";
import type { LogChanges } from "@/lib/kas.functions";
import { ensureKasDefaults } from "@/lib/kas-seed";
import { startOfWeekWIB } from "@/lib/week";
import {
  MAX_LIST_ROWS,
  assertDateString,
  assertEnum,
  assertKeterangan,
  assertNominal,
  assertOptionalDateString,
  assertReason,
  assertSearch,
} from "@/lib/validate";

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

export type LedgerOrder = "asc" | "desc";
export type { LedgerMethod, LedgerTipe };

export interface LedgerFilter {
  search?: string;
  tipe?: LedgerTipe | "semua";
  method?: LedgerMethod | "semua";
  sort?: LedgerOrder;
  from?: string;
  to?: string;
  periodeId?: string;
  /** Batas baris server-side (default 1000, maks 2000). */
  limit?: number;
}

async function resolvePeriode(periodeId: string | undefined, actorId: string) {
  if (periodeId) {
    const [p] = await db
      .select()
      .from(kasPeriode)
      .where(eq(kasPeriode.id, periodeId))
      .limit(1);
    if (!p) throw new Error("Periode tidak ditemukan");
    return p;
  }
  // DB fresh (habis migrate): seed Periode 1 + setting default.
  const { active } = await ensureKasDefaults(actorId);
  if (!active) throw new Error("Belum ada periode kas");
  return active;
}

export interface LedgerRow {
  id: string;
  tanggal: Date;
  keterangan: string;
  tipe: string;
  debit: number;
  kredit: number;
  method: string;
  auto: boolean;
  saldo: number;
}

export const listLedgerEntries = createServerFn({ method: "GET" })
  .validator((f: LedgerFilter) => f ?? {})
  .handler(async ({ data }): Promise<LedgerRow[]> => {
    await requireSession();
    const search = assertSearch(data.search);
    const tipe =
      data.tipe === undefined || data.tipe === "semua"
        ? undefined
        : assertEnum(data.tipe, LEDGER_TIPES, "Tipe");
    const method =
      data.method === undefined || data.method === "semua"
        ? undefined
        : assertEnum(data.method, LEDGER_METHODS, "Metode");
    const sort = assertEnum(data.sort ?? "desc", ["asc", "desc"] as const, "Urutan");
    const from = assertOptionalDateString(data.from, "Dari tanggal");
    const to = assertOptionalDateString(data.to, "Sampai tanggal");
    const periodeId =
      typeof data.periodeId === "string" && data.periodeId ? data.periodeId : undefined;
    const limit =
      data.limit === undefined
        ? 1000
        : Number.isInteger(data.limit) && (data.limit as number) >= 1
          ? Math.min(data.limit as number, MAX_LIST_ROWS)
          : (() => {
              throw new Error("Limit tidak valid");
            })();
    const { search: _s, tipe: _ti, method: _m, sort: _so, from: _f, to: _t, periodeId: _p, limit: _l, ...rest } = data;
    void _s; void _ti; void _m; void _so; void _f; void _t; void _p; void _l;
    if (Object.keys(rest).length > 0) throw new Error("Filter tidak dikenal");

    const conditions: SQL[] = [];
    if (periodeId) conditions.push(eq(ledgerEntry.periodeId, periodeId));
    if (tipe) {
      conditions.push(eq(ledgerEntry.tipe, tipe));
    }
    if (method) {
      conditions.push(eq(ledgerEntry.method, method));
    }
    if (from) conditions.push(gte(ledgerEntry.tanggal, from));
    if (to) conditions.push(lte(ledgerEntry.tanggal, to));
    if (search) {
      conditions.push(ilike(ledgerEntry.keterangan, `%${search}%`));
    }

    // Saldo running dihitung dari urutan menaik atas baris yang lolos
    // filter (bukan saldo global) — label UI harus menjelaskan cakupan.
    const rows = await db
      .select()
      .from(ledgerEntry)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(ledgerEntry.tanggal))
      .limit(limit);
    let saldo = 0;
    const withSaldo = rows.map((r) => {
      saldo += r.debit - r.kredit;
      return {
        id: r.id,
        tanggal: r.tanggal,
        keterangan: r.keterangan,
        tipe: r.tipe,
        debit: r.debit,
        kredit: r.kredit,
        method: r.method,
        auto: r.sourceCashEntryId !== null,
        saldo,
      };
    });
    return sort === "desc" ? withSaldo.reverse() : withSaldo;
  });

export interface DashboardData {
  periode: { id: string; nomor: number; nominal: number; status: string };
  saldo: number;
  masukPeriode: number;
  keluarPeriode: number;
  ekspektasiPeriode: number;
  nominalKas: number;
  userCount: number;
  bendaharaList: { id: string; name: string; email: string }[];
}

export interface DashboardFilter {
  periodeId?: string;
}

export const getDashboardData = createServerFn({ method: "GET" })
  .validator((f: DashboardFilter) => f ?? {})
  .handler(async ({ data }): Promise<DashboardData> => {
    const session = await requireSession();
    const { periodeId: _p, ...rest } = data;
    void _p;
    if (Object.keys(rest).length > 0) throw new Error("Filter tidak dikenal");
    const periodeId =
      typeof data.periodeId === "string" && data.periodeId ? data.periodeId : undefined;
    const periode = await resolvePeriode(periodeId, session.user.id);

    const [{ masuk = 0, keluar = 0 }] = await db
      .select({
        masuk: sql<number>`coalesce(sum(${ledgerEntry.debit}), 0)`,
        keluar: sql<number>`coalesce(sum(${ledgerEntry.kredit}), 0)`,
      })
      .from(ledgerEntry);

    const [{ masukPeriode = 0, keluarPeriode = 0 }] = await db
      .select({
        masukPeriode: sql<number>`coalesce(sum(${ledgerEntry.debit}), 0)`,
        keluarPeriode: sql<number>`coalesce(sum(${ledgerEntry.kredit}), 0)`,
      })
      .from(ledgerEntry)
      .where(eq(ledgerEntry.periodeId, periode.id));

    const [{ count = 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(user);

    const bendaharaList = await db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.role, "bendahara"));

    return {
      periode: {
        id: periode.id,
        nomor: periode.nomor,
        nominal: periode.nominal,
        status: periode.status,
      },
      saldo: Number(masuk) - Number(keluar),
      masukPeriode: Number(masukPeriode),
      keluarPeriode: Number(keluarPeriode),
      ekspektasiPeriode: periode.nominal * Number(count),
      nominalKas: periode.nominal,
      userCount: Number(count),
      bendaharaList,
    };
  });

export interface CreateLedgerInput {
  tanggal?: string;
  keterangan: string;
  tipe: LedgerTipe;
  amount: number;
  method: LedgerMethod;
  reason: string;
}

export const createLedgerEntry = createServerFn({ method: "POST" })
  .validator((d: CreateLedgerInput) => d)
  .handler(async ({ data }) => {
    const session = await requireBendahara();
    const keterangan = assertKeterangan(data.keterangan);
    const tipe = assertEnum(data.tipe, LEDGER_TIPES, "Tipe");
    const method = assertEnum(data.method, LEDGER_METHODS, "Metode");
    const amount = assertNominal(data.amount);
    const reason = assertReason(data.reason);
    const tanggal =
      data.tanggal === undefined || data.tanggal === ""
        ? new Date()
        : assertDateString(data.tanggal);

    return db.transaction(async (tx) => {
      const [active] = await tx
        .select()
        .from(kasPeriode)
        .where(eq(kasPeriode.status, "aktif"))
        .limit(1);
      // DB fresh: seed Periode 1 (nominal 5000) + setting default.
      const { active: seeded } = active
        ? { active }
        : await ensureKasDefaults(session.user.id);
      if (!seeded) throw new Error("Gagal menyiapkan periode kas");
      // Kunci periode aktif agar penutupan periode tidak bisa menyela
      // antara pemilihan periode dan insert.
      const locked = await tx.execute(
        sql`SELECT status FROM ${kasPeriode} WHERE id = ${seeded.id} FOR UPDATE`,
      );
      const status = (locked.rows[0] as { status?: string } | undefined)?.status;
      if (status && status !== "aktif") {
        throw new Error("Periode sudah ditutup, coba lagi di periode baru");
      }
      const [row] = await tx
        .insert(ledgerEntry)
        .values({
          id: crypto.randomUUID(),
          tanggal,
          keterangan,
          tipe,
          debit: tipe === "masuk" ? amount : 0,
          kredit: tipe === "keluar" ? amount : 0,
          method,
          sourceCashEntryId: null,
          createdBy: session.user.id,
          periodeId: seeded.id,
        })
        .returning();
      await tx.insert(activityLog).values({
        id: crypto.randomUUID(),
        actorId: session.user.id,
        action: "create",
        entity: "ledger",
        entityId: row.id,
        changes: JSON.stringify({
          keterangan: { old: null, new: row.keterangan },
          tipe: { old: null, new: row.tipe },
          nominal: { old: null, new: amount },
          metode: { old: null, new: row.method },
          tanggal: { old: null, new: row.tanggal.toISOString() },
        } satisfies LogChanges),
        reason,
      });
      return row;
    });
  });

export interface UpdateLedgerInput {
  id: string;
  tanggal?: string;
  keterangan?: string;
  amount?: number;
  method?: LedgerMethod;
  reason: string;
}

export const updateLedgerEntry = createServerFn({ method: "POST" })
  .validator((d: UpdateLedgerInput) => d)
  .handler(async ({ data }) => {
    const session = await requireBendahara();
    if (!data.id || typeof data.id !== "string") throw new Error("ID wajib diisi");
    const reason = assertReason(data.reason);

    return db.transaction(async (tx) => {
      const old = await tx.query.ledgerEntry.findFirst({
        where: eq(ledgerEntry.id, data.id),
      });
      if (!old) throw new Error("Data keuangan tidak ditemukan");
      if (old.sourceCashEntryId) {
        throw new Error("Entri otomatis dari kas hanya bisa diubah via kas");
      }
      if (old.periodeId) {
        // Kunci baris periode di dalam transaksi (cek + tulis atomik).
        const locked = await tx.execute(
          sql`SELECT status FROM ${kasPeriode} WHERE id = ${old.periodeId} FOR UPDATE`,
        );
        const status = (locked.rows[0] as { status?: string } | undefined)?.status;
        if (status && status !== "aktif") {
          throw new Error("Periode sudah ditutup, tidak bisa diubah");
        }
      }

      const patch: Partial<typeof ledgerEntry.$inferInsert> = {};
      const changes: LogChanges = {};
      if (data.keterangan !== undefined) {
        const keterangan = assertKeterangan(data.keterangan);
        if (keterangan !== old.keterangan) {
          patch.keterangan = keterangan;
          changes.keterangan = { old: old.keterangan, new: patch.keterangan };
        }
      }
      if (data.amount !== undefined) {
        const amount = assertNominal(data.amount);
        const oldAmount = old.tipe === "masuk" ? old.debit : old.kredit;
        if (amount !== oldAmount) {
          if (old.tipe === "masuk") patch.debit = amount;
          else patch.kredit = amount;
          changes.nominal = { old: oldAmount, new: amount };
        }
      }
      if (data.method !== undefined) {
        const method = assertEnum(data.method, LEDGER_METHODS, "Metode");
        if (method !== old.method) {
          patch.method = method;
          changes.metode = { old: old.method, new: method };
        }
      }
      if (data.tanggal !== undefined) {
        const t = assertDateString(data.tanggal);
        if (t.getTime() !== new Date(old.tanggal).getTime()) {
          patch.tanggal = t;
          changes.tanggal = {
            old: new Date(old.tanggal).toISOString(),
            new: t.toISOString(),
          };
        }
      }
      if (Object.keys(changes).length === 0) {
        throw new Error("Tidak ada perubahan");
      }
      const [row] = await tx
        .update(ledgerEntry)
        .set(patch)
        .where(eq(ledgerEntry.id, data.id))
        .returning();
      await tx.insert(activityLog).values({
        id: crypto.randomUUID(),
        actorId: session.user.id,
        action: "update",
        entity: "ledger",
        entityId: row.id,
        changes: JSON.stringify(changes),
        reason,
      });
      return row;
    });
  });
