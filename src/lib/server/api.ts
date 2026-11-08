import { timingSafeEqual } from "node:crypto";
import { Elysia, status } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import type { CashMethod, LedgerMethod, LedgerTipe } from "@/db/kas-schema";
import {
    createCashEntryFor,
    getCashStatsFor,
    getUserKasStatusFor,
    listCashEntriesFor,
    listUsersFor,
    type CashFilter,
    type CreateCashInput,
} from "@/lib/server/kas";
import {
    createLedgerEntryFor,
    getDashboardDataFor,
    listLedgerEntriesFor,
    type CreateLedgerInput,
    type LedgerFilter,
} from "@/lib/server/ledger";
import { listPeriodesFor } from "@/lib/server/periode";

/**
 * API publik untuk service pihak ketiga / AI agent.
 * Auth: `Authorization: Bearer <API_KEY>` (env) atas nama `API_ACTOR_ID`.
 * Semua endpoint hanya membungkus service function yang juga dipakai web,
 * jadi aturan validasi, audit log, dan auto-posting tetap sama.
 */

type ApiActor = { actorId: string; isBendahara: boolean };

class ApiError extends Error {
    constructor(
        readonly code: 400 | 401 | 403 | 503,
        message: string,
    ) {
        super(message);
    }
}

function apiConfig() {
    const key = process.env.API_KEY?.trim();
    const actorId = process.env.API_ACTOR_ID?.trim();
    return key && actorId ? { key, actorId } : null;
}

function keyMatches(given: string, expected: string) {
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

async function authenticate(request: Request): Promise<ApiActor> {
    const config = apiConfig();
    if (!config) throw new ApiError(503, "API belum dikonfigurasi (API_KEY/API_ACTOR_ID)");
    const header = request.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token || !keyMatches(token, config.key)) {
        throw new ApiError(401, "Unauthorized");
    }
    const [actor] = await db
        .select({ id: user.id, role: user.role })
        .from(user)
        .where(eq(user.id, config.actorId))
        .limit(1);
    if (!actor) throw new ApiError(403, "API_ACTOR_ID tidak terdaftar");
    return { actorId: actor.id, isBendahara: actor.role === "bendahara" };
}

async function run(request: Request, fn: (actor: ApiActor) => Promise<unknown>) {
    try {
        const actor = await authenticate(request);
        return await fn(actor);
    } catch (err) {
        if (err instanceof ApiError) return status(err.code, { error: err.message });
        // Jangan kirim detail exception DB/runtime ke pemanggil API.
        return status(500, { error: "Internal server error" });
    }
}

function requireBendahara(actor: ApiActor) {
    if (!actor.isBendahara) throw new ApiError(403, "Forbidden: actor bukan bendahara");
}

const limitOf = (value: string | undefined) =>
    value === undefined || value === "" ? undefined : Number(value);

function cashFilter(q: Record<string, string | undefined>): CashFilter {
    return {
        search: q.search,
        method: q.method as CashMethod | "semua" | undefined,
        sort: q.sort as CashFilter["sort"],
        order: q.order as CashFilter["order"],
        from: q.from,
        to: q.to,
        periodeId: q.periodeId,
        limit: limitOf(q.limit),
    };
}

function ledgerFilter(q: Record<string, string | undefined>): LedgerFilter {
    return {
        search: q.search,
        tipe: q.tipe as LedgerTipe | "semua" | undefined,
        method: q.method as LedgerMethod | "semua" | undefined,
        sort: q.sort as LedgerFilter["sort"],
        from: q.from,
        to: q.to,
        periodeId: q.periodeId,
        limit: limitOf(q.limit),
    };
}

async function kasInput(actorId: string, body: unknown): Promise<CreateCashInput> {
    const b = (body ?? {}) as Record<string, unknown>;
    // Default ke nominal periode aktif agar bot cukup menyebut penyetor.
    const amount = b.amount === undefined ? (await getCashStatsFor(actorId, {})).nominalKas : Number(b.amount);
    return {
        depositorUserId:
            b.depositorUserId === undefined || b.depositorUserId === null
                ? ""
                : String(b.depositorUserId),
        amount,
        method: b.method as CashMethod,
        paidAt: b.paidAt as string | undefined,
        reason: b.reason as string | undefined,
    };
}

function ledgerInput(body: unknown): CreateLedgerInput {
    const b = (body ?? {}) as Record<string, unknown>;
    return {
        tanggal: b.tanggal as string | undefined,
        keterangan: b.keterangan as string,
        tipe: b.tipe as LedgerTipe,
        amount: Number(b.amount),
        method: b.method as LedgerMethod,
        reason: b.reason as string,
    };
}

export const publicApi = new Elysia({ prefix: "/v1" })
    .get("/", () => ({
        name: "Bendahara API",
        auth: "Authorization: Bearer <API_KEY>",
        endpoints: {
            "GET /api/v1/overview?periodeId=": "ringkasan saldo, periode aktif, ekspektasi",
            "GET /api/v1/users": "daftar anggota (id = NIM, nama, email)",
            "GET /api/v1/kas?periodeId=&limit=&search=&method=&from=&to=": "riwayat setoran",
            "GET /api/v1/kas/status?periodeId=": "status iuran per anggota",
            "GET /api/v1/ledger?periodeId=&limit=&search=&tipe=&method=&from=&to=": "buku keuangan",
            "GET /api/v1/periode": "daftar periode (aktif + arsip)",
            "POST /api/v1/kas": "catat setoran kas (depositorUserId=NIM, amount?, method, paidAt?, reason?)",
            "POST /api/v1/ledger": "catat entri manual (keterangan, tipe, amount, method, tanggal?, reason)",
        },
    }))
    .get("/overview", ({ request, query }) =>
        run(request, (actor) =>
            getDashboardDataFor(actor.actorId, { periodeId: query.periodeId }),
        ),
    )
    .get("/users", ({ request }) => run(request, () => listUsersFor()))
    .get("/kas", ({ request, query }) =>
        run(request, () => listCashEntriesFor(cashFilter(query))),
    )
    .get("/kas/status", ({ request, query }) =>
        run(request, (actor) =>
            getUserKasStatusFor(actor.actorId, { periodeId: query.periodeId }),
        ),
    )
    .get("/ledger", ({ request, query }) =>
        run(request, () => listLedgerEntriesFor(ledgerFilter(query))),
    )
    .get("/periode", ({ request }) =>
        run(request, (actor) => listPeriodesFor(actor.actorId)),
    )
    .post("/kas", ({ request, body }) =>
        run(request, async (actor) => {
            requireBendahara(actor);
            return createCashEntryFor(actor.actorId, await kasInput(actor.actorId, body));
        }),
    )
    .post("/ledger", ({ request, body }) =>
        run(request, async (actor) => {
            requireBendahara(actor);
            return createLedgerEntryFor(actor.actorId, ledgerInput(body));
        }),
    );
