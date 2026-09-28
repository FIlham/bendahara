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
    or,
    sql,
    type SQL,
} from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { startOfWeekWIB } from "@/lib/week";
import { compareByNim } from "@/lib/nim";
import {
    CASH_METHODS,
    activityLog,
    cashEntry,
    kasPeriode,
    ledgerEntry,
    type CashMethod,
} from "@/db/kas-schema";
import { ensureKasDefaults } from "@/lib/kas-seed";
import {
    MAX_LIST_ROWS,
    assertDateString,
    assertEnum,
    assertNominal,
    assertNominalKas,
    assertOptionalDateString,
    assertReason,
    assertSearch,
} from "@/lib/validate";
import { getEnv } from "./env";

export { startOfWeekWIB };

export type CashSort = "paidAt" | "amount" | "depositor";
export type CashOrder = "asc" | "desc";
export type { CashMethod };

export interface CashFilter {
    search?: string;
    method?: CashMethod | "semua";
    sort?: CashSort;
    order?: CashOrder;
    from?: string;
    to?: string;
    periodeId?: string;
    /** Batas baris server-side (default 500, maks 2000). */
    limit?: number;
}

/** Periode aktif, atau seed default (Periode 1, nominal 5000) bila DB masih kosong. */
async function ensureActivePeriode(actorId: string) {
    const { active } = await ensureKasDefaults(actorId);
    if (!active) throw new Error("Gagal menyiapkan periode kas");
    return active;
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

export type LogChange = { old: string | number | null; new: string | number | null };
export type LogChanges = Record<string, LogChange>;

export const listCashEntries = createServerFn({ method: "GET" })
    .validator((f: CashFilter) => f ?? {})
    .handler(async ({ data }) => {
        await requireSession();
        const search = assertSearch(data.search);
        const method =
            data.method === undefined || data.method === "semua"
                ? undefined
                : assertEnum(data.method, CASH_METHODS, "Metode");
        const sort = assertEnum(data.sort ?? "paidAt", ["paidAt", "amount", "depositor"] as const, "Sort");
        const order = assertEnum(data.order ?? "desc", ["asc", "desc"] as const, "Urutan");
        const from = assertOptionalDateString(data.from, "Dari tanggal");
        const to = assertOptionalDateString(data.to, "Sampai tanggal");
        const periodeId =
            typeof data.periodeId === "string" && data.periodeId ? data.periodeId : undefined;
        const limit =
            data.limit === undefined
                ? 500
                : Number.isInteger(data.limit) && (data.limit as number) >= 1
                    ? Math.min(data.limit as number, MAX_LIST_ROWS)
                    : (() => {
                        throw new Error("Limit tidak valid");
                    })();
        const { search: _s, method: _m, sort: _so, order: _o, from: _f, to: _t, periodeId: _p, limit: _l, ...rest } = data;
        void _s; void _m; void _so; void _o; void _f; void _t; void _p; void _l;
        if (Object.keys(rest).length > 0) throw new Error("Filter tidak dikenal");

        const conditions: SQL[] = [];
        if (periodeId) conditions.push(eq(cashEntry.periodeId, periodeId));
        if (method) {
            conditions.push(eq(cashEntry.method, method));
        }
        if (from) conditions.push(gte(cashEntry.paidAt, from));
        if (to) conditions.push(lte(cashEntry.paidAt, to));
        if (search) {
            const q = `%${search}%`;
            conditions.push(
                or(ilike(user.name, q), ilike(user.email, q)) as unknown as SQL,
            );
        }

        const orderBy =
            sort === "amount"
                ? order === "asc"
                    ? asc(cashEntry.amount)
                    : desc(cashEntry.amount)
                : sort === "depositor"
                    ? order === "asc"
                        ? asc(user.name)
                        : desc(user.name)
                    : order === "asc"
                        ? asc(cashEntry.paidAt)
                        : desc(cashEntry.paidAt);

        const rows = await db
            .select({
                id: cashEntry.id,
                amount: cashEntry.amount,
                method: cashEntry.method,
                paidAt: cashEntry.paidAt,
                updatedAt: cashEntry.updatedAt,
                depositor: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                },
            })
            .from(cashEntry)
            .innerJoin(user, eq(cashEntry.depositorUserId, user.id))
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(orderBy)
            .limit(limit);

        return rows;
    });

export interface CashStatsFilter {
    periodeId?: string;
}

export const getCashStats = createServerFn({ method: "GET" })
    .validator((f: CashStatsFilter) => f ?? {})
    .handler(async ({ data }) => {
        const session = await requireSession();
        const { periodeId: _p, ...rest } = data;
        void _p;
        if (Object.keys(rest).length > 0) throw new Error("Filter tidak dikenal");
        const periodeId =
            typeof data.periodeId === "string" && data.periodeId ? data.periodeId : undefined;
        const periode = await resolvePeriode(periodeId, session.user.id);

        const [{ total: totalPeriode }] = await db
            .select({ total: sql<number>`coalesce(sum(${cashEntry.amount}), 0)` })
            .from(cashEntry)
            .where(eq(cashEntry.periodeId, periode.id));

        const [{ total: totalSemua }] = await db
            .select({ total: sql<number>`coalesce(sum(${cashEntry.amount}), 0)` })
            .from(cashEntry);

        const [{ count: userCount }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(user);

        const bendaharaList = await db
            .select({ id: user.id, name: user.name, email: user.email })
            .from(user)
            .where(eq(user.role, "bendahara"));

        const nominalKas = periode.nominal;
        return {
            periode: {
                id: periode.id,
                nomor: periode.nomor,
                nominal: periode.nominal,
                status: periode.status,
            },
            nominalKas,
            totalPeriode: Number(totalPeriode),
            ekspektasiPeriode: nominalKas * Number(userCount),
            userCount: Number(userCount),
            totalSemua: Number(totalSemua),
            bendaharaList,
        };
    });

export const listUsers = createServerFn({ method: "GET" }).handler(async () => {
    await requireBendahara();
    const rows = await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user);
    // Urut NIM low-to-high (NIM = user.id string numerik).
    rows.sort(compareByNim);
    return rows;
});

export interface CreateCashInput {
    depositorUserId: string;
    amount: number;
    method: CashMethod;
    paidAt?: string;
    reason?: string;
}

function assertValidCashInput(input: CreateCashInput) {
    if (!input.depositorUserId || typeof input.depositorUserId !== "string") {
        throw new Error("Penyetor wajib diisi");
    }
    assertNominal(input.amount);
    assertEnum(input.method, CASH_METHODS, "Metode");
    if (input.paidAt !== undefined) assertDateString(input.paidAt);
    if (input.reason !== undefined && input.reason !== "") {
        assertReason(input.reason, "Catatan");
    }
}

export const createCashEntry = createServerFn({ method: "POST" })
    .validator((d: CreateCashInput) => d)
    .handler(async ({ data }) => {
        const session = await requireBendahara();
        assertValidCashInput(data);

        const depositor = await db.query.user.findFirst({
            where: eq(user.id, data.depositorUserId),
        });
        if (!depositor) throw new Error("Penyetor tidak terdaftar");

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
            const periode = seeded;
            if (!periode) throw new Error("Gagal menyiapkan periode kas");
            // Kunci periode aktif agar penutupan periode tidak bisa menyela
            // antara pemilihan periode dan insert (tulis ke arsip ditolak).
            const locked = await tx.execute(
                sql`SELECT status FROM ${kasPeriode} WHERE id = ${periode.id} FOR UPDATE`,
            );
            const status = (locked.rows[0] as { status?: string } | undefined)?.status;
            if (status && status !== "aktif") {
                throw new Error("Periode sudah ditutup, coba lagi di periode baru");
            }
            const [row] = await tx
                .insert(cashEntry)
                .values({
                    id: crypto.randomUUID(),
                    depositorUserId: data.depositorUserId,
                    amount: data.amount,
                    method: data.method,
                    paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
                    createdBy: session.user.id,
                    periodeId: periode.id,
                })
                .returning();
            // Auto-posting ke buku ledger sebagai pemasukan.
            await tx.insert(ledgerEntry).values({
                id: crypto.randomUUID(),
                tanggal: row.paidAt,
                keterangan: `Iuran kas — ${depositor.name}`,
                tipe: "masuk",
                debit: row.amount,
                kredit: 0,
                method: row.method === "tunai" ? "tunai" : "transfer",
                sourceCashEntryId: row.id,
                createdBy: session.user.id,
                periodeId: periode.id,
            });
            await tx.insert(activityLog).values({
                id: crypto.randomUUID(),
                actorId: session.user.id,
                action: "create",
                entity: "kas",
                entityId: row.id,
                changes: JSON.stringify({
                    penyetor: { old: null, new: depositor.name },
                    nominal: { old: null, new: row.amount },
                    metode: { old: null, new: row.method },
                    tanggal: { old: null, new: row.paidAt.toISOString() },
                } satisfies LogChanges),
                reason: data.reason?.trim() || null,
            });
            return row;
        });
    });

export interface UpdateCashInput {
    id: string;
    depositorUserId?: string;
    amount?: number;
    method?: CashMethod;
    paidAt?: string;
    /** Wajib diisi: alasan perubahan, dicatat di log transparansi. */
    reason: string;
}

export const updateCashEntry = createServerFn({ method: "POST" })
    .validator((d: UpdateCashInput) => d)
    .handler(async ({ data }) => {
        const session = await requireBendahara();
        if (!data.id || typeof data.id !== "string") throw new Error("ID wajib diisi");
        const reason = assertReason(data.reason);

        return db.transaction(async (tx) => {
            const old = await tx.query.cashEntry.findFirst({
                where: eq(cashEntry.id, data.id),
            });
            if (!old) throw new Error("Data kas tidak ditemukan");
            // Kunci baris periode di dalam transaksi agar periode tidak bisa
            // ditutup di tengah update (cek + tulis atomik).
            if (old.periodeId) {
                const locked = await tx.execute(
                    sql`SELECT status FROM ${kasPeriode} WHERE id = ${old.periodeId} FOR UPDATE`,
                );
                const status = (locked.rows[0] as { status?: string } | undefined)?.status;
                if (status && status !== "aktif") {
                    throw new Error("Periode sudah ditutup, tidak bisa diubah");
                }
            }

            const patch: Partial<typeof cashEntry.$inferInsert> = {};
            const changes: LogChanges = {};
            if (data.depositorUserId !== undefined) {
                if (typeof data.depositorUserId !== "string" || !data.depositorUserId) {
                    throw new Error("Penyetor tidak valid");
                }
                const depositor = await tx.query.user.findFirst({
                    where: eq(user.id, data.depositorUserId),
                });
                if (!depositor) throw new Error("Penyetor tidak terdaftar");
                if (data.depositorUserId !== old.depositorUserId) {
                    const oldDepositor = await tx.query.user.findFirst({
                        where: eq(user.id, old.depositorUserId),
                    });
                    patch.depositorUserId = data.depositorUserId;
                    changes.penyetor = {
                        old: oldDepositor?.name ?? old.depositorUserId,
                        new: depositor.name,
                    };
                }
            }
            if (data.amount !== undefined) {
                assertNominal(data.amount);
                if (data.amount !== old.amount) {
                    patch.amount = data.amount;
                    changes.nominal = { old: old.amount, new: data.amount };
                }
            }
            if (data.method !== undefined) {
                assertEnum(data.method, CASH_METHODS, "Metode");
                if (data.method !== old.method) {
                    patch.method = data.method;
                    changes.metode = { old: old.method, new: data.method };
                }
            }
            if (data.paidAt !== undefined) {
                const t = assertDateString(data.paidAt);
                if (t.getTime() !== new Date(old.paidAt).getTime()) {
                    patch.paidAt = t;
                    changes.tanggal = {
                        old: new Date(old.paidAt).toISOString(),
                        new: t.toISOString(),
                    };
                }
            }

            if (Object.keys(changes).length === 0) {
                throw new Error("Tidak ada perubahan");
            }

            const [row] = await tx
                .update(cashEntry)
                .set(patch)
                .where(eq(cashEntry.id, data.id))
                .returning();
            if (!row) throw new Error("Data kas tidak ditemukan");
            // Sinkronisasi baris ledger yang terposting otomatis.
            const [linked] = await tx
                .select()
                .from(ledgerEntry)
                .where(eq(ledgerEntry.sourceCashEntryId, row.id))
                .limit(1);
            const ledgerMethod = row.method === "tunai" ? "tunai" : "transfer";
            const ledgerKeterangan =
                changes.penyetor && typeof changes.penyetor.new === "string"
                    ? `Iuran kas — ${changes.penyetor.new}`
                    : undefined;
            if (linked) {
                await tx
                    .update(ledgerEntry)
                    .set({
                        tanggal: row.paidAt,
                        ...(ledgerKeterangan ? { keterangan: ledgerKeterangan } : {}),
                        debit: row.amount,
                        method: ledgerMethod,
                    })
                    .where(eq(ledgerEntry.id, linked.id));
            } else {
                const depName =
                    changes.penyetor && typeof changes.penyetor.new === "string"
                        ? changes.penyetor.new
                        : (await tx.query.user.findFirst({
                            where: eq(user.id, row.depositorUserId),
                        }))?.name ?? row.depositorUserId;
                await tx.insert(ledgerEntry).values({
                    id: crypto.randomUUID(),
                    tanggal: row.paidAt,
                    keterangan: `Iuran kas — ${depName}`,
                    tipe: "masuk",
                    debit: row.amount,
                    kredit: 0,
                    method: ledgerMethod,
                    sourceCashEntryId: row.id,
                    createdBy: session.user.id,
                    periodeId: row.periodeId,
                });
            }
            await tx.insert(activityLog).values({
                id: crypto.randomUUID(),
                actorId: session.user.id,
                action: "update",
                entity: "kas",
                entityId: row.id,
                changes: JSON.stringify(changes),
                reason,
            });
            return row;
        });
    });

// No deleteCashEntry by design: entries are immutable history (transparency).

export interface UserKasStatus {
    id: string;
    name: string;
    email: string;
    /** Kurang bayar pada periode acuan (0 = lunas minggu ini). */
    kurang: number;
    /** Total setor user pada periode acuan (direset tiap minggu). */
    totalBayar: number;
    lastMethod: string | null;
    mingguLunas: number;
    mingguTotal: number;
}

/**
 * Status iuran per user, direset tiap periode (tanpa carry-over):
 * setiap minggu berdiri sendiri — target = nominal periode tersebut,
 * terkumpul = total setor user pada periode tersebut.
 */
export interface KasStatusFilter {
    periodeId?: string;
}

export const getUserKasStatus = createServerFn({ method: "GET" })
    .validator((f: KasStatusFilter) => f ?? {})
    .handler(async ({ data }): Promise<UserKasStatus[]> => {
        const session = await requireSession();
        const { periodeId: _p, ...rest } = data;
        void _p;
        if (Object.keys(rest).length > 0) throw new Error("Filter tidak dikenal");
        const periodeId =
            typeof data.periodeId === "string" && data.periodeId ? data.periodeId : undefined;
        let allPeriods = await db
            .select()
            .from(kasPeriode)
            .orderBy(asc(kasPeriode.nomor));
        if (allPeriods.length === 0) {
            // DB fresh (habis migrate): seed Periode 1 + setting default.
            await ensureKasDefaults(session.user.id);
            allPeriods = await db
                .select()
                .from(kasPeriode)
                .orderBy(asc(kasPeriode.nomor));
            if (allPeriods.length === 0) return [];
        }
        // Periode acuan: yang diminta, lalu yang aktif, lalu yang terbaru.
        let scope = periodeId
            ? allPeriods.find((p) => p.id === periodeId)
            : allPeriods.find((p) => p.status === "aktif");
        if (periodeId && !scope) throw new Error("Periode tidak ditemukan");
        if (!scope) scope = allPeriods[allPeriods.length - 1];
        const scopeId = (scope as (typeof allPeriods)[number]).id;
        const nominal = (scope as (typeof allPeriods)[number]).nominal;

        const users = await db
            .select({
                id: user.id,
                name: user.name,
                email: user.email,
            })
            .from(user);
        // Urut NIM low-to-high (NIM = user.id string numerik).
        users.sort(compareByNim);
        const payments = await db
            .select({
                depositorUserId: cashEntry.depositorUserId,
                amount: cashEntry.amount,
                paidAt: cashEntry.paidAt,
                method: cashEntry.method,
            })
            .from(cashEntry)
            .where(eq(cashEntry.periodeId, scopeId))
            .orderBy(asc(cashEntry.paidAt));

        const byUser = new Map<string, typeof payments>();
        for (const p of payments) {
            const list = byUser.get(p.depositorUserId) ?? [];
            list.push(p);
            byUser.set(p.depositorUserId, list);
        }

        return users.map((u) => {
            const mine = byUser.get(u.id) ?? [];
            const totalBayar = mine.reduce((s, p) => s + p.amount, 0);
            const kurang = Math.max(0, nominal - totalBayar);
            return {
                id: u.id,
                name: u.name,
                email: u.email,
                kurang,
                totalBayar,
                lastMethod: mine.length ? mine[mine.length - 1].method : null,
                mingguLunas: totalBayar >= nominal ? 1 : 0,
                mingguTotal: 1,
            };
        });
    });

export const updateNominalKas = createServerFn({ method: "POST" })
    .validator((d: { value: number; reason?: string }) => d)
    .handler(async ({ data }) => {
        const session = await requireBendahara();
        const value = assertNominalKas(data.value);
        const reason =
            data.reason === undefined || data.reason === null || data.reason === ""
                ? null
                : assertReason(data.reason);
        return db.transaction(async (tx) => {
            // Kunci baris periode aktif agar pembaca/writer lain tidak
            // mengubah nominal bersamaan tanpa terlihat di audit log.
            const locked = await tx.execute(
                sql`SELECT id, nominal FROM ${kasPeriode} WHERE status = 'aktif' LIMIT 1 FOR UPDATE`,
            );
            let active = (locked.rows[0] as { id: string; nominal: number } | undefined) ?? null;
            if (!active) {
                // Nominal kini milik periode aktif (snapshot per periode).
                const seeded = await ensureActivePeriode(session.user.id);
                active = { id: seeded.id, nominal: seeded.nominal };
            }
            const prevNominal = active.nominal;
            if (prevNominal === value) throw new Error("Tidak ada perubahan");
            await tx
                .update(kasPeriode)
                .set({ nominal: value })
                .where(eq(kasPeriode.id, active.id));
            await tx.insert(activityLog).values({
                id: crypto.randomUUID(),
                actorId: session.user.id,
                action: "update",
                entity: "nominal",
                entityId: active.id,
                changes: JSON.stringify({
                    nominal: { old: prevNominal, new: value },
                } satisfies LogChanges),
                reason,
            });
            return { value };
        });
    });

export const getQRIS = createServerFn({ method: "POST" })
    .handler(() => getEnv("QRIS_URL"))