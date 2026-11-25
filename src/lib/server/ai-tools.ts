import { readTools, writeTools } from "@/lib/ai/tools";
import {
    createCashEntryFor,
    getCashStatsFor,
    getUserKasStatusFor,
    listCashEntriesFor,
} from "@/lib/server/kas";
import {
    createLedgerEntryFor,
    getDashboardDataFor,
    listLedgerEntriesFor,
} from "@/lib/server/ledger";
import { listPeriodesFor } from "@/lib/server/periode";

/**
 * Tool chatbot untuk satu request. Semua eksekusi memakai service function yang
 * sama dengan web dan /api/v1, jadi validasi, kunci periode, dan audit log
 * tetap berlaku. Aktor selalu dari session server, bukan dari body request.
 */
export function buildTools({
    actorId,
    isBendahara,
}: {
    actorId: string;
    isBendahara: boolean;
}) {
    const [ringkasan, periode, kas, status, ledger] = readTools;
    const [setoran, entri] = writeTools;

    const tools = [
        ringkasan.server((input) => getDashboardDataFor(actorId, input)),
        periode.server(() => listPeriodesFor(actorId)),
        kas.server(async (input) =>
            (
                await listCashEntriesFor({
                    ...input,
                    limit: input.limit ?? 20,
                })
            ).map((row) => ({
                id: row.id,
                amount: row.amount,
                method: row.method,
                paidAt: row.paidAt,
                depositor: { id: row.depositor.id, name: row.depositor.name },
            })),
        ),
        status.server(async (input) =>
            (await getUserKasStatusFor(actorId, input)).map((row) => ({
                id: row.id,
                name: row.name,
                totalBayar: row.totalBayar,
                kurang: row.kurang,
                lunas: row.kurang === 0,
                lastMethod: row.lastMethod,
            })),
        ),
        ledger.server((input) =>
            listLedgerEntriesFor({ ...input, limit: input.limit ?? 20 }),
        ),
    ];

    // Tanpa tool tulis di array ini, approval palsu dari klien tidak bisa
    // mengeksekusi apa pun (tool yang tidak terdaftar tidak pernah dijalankan).
    if (!isBendahara) return tools;

    return [
        ...tools,
        setoran.server(async (input) => {
            const amount =
                input.amount ??
                (await getCashStatsFor(actorId, {})).nominalKas;
            const row = await createCashEntryFor(actorId, { ...input, amount });
            return {
                tercatat: true,
                id: row.id,
                nominal: row.amount,
                metode: row.method,
                tanggal: row.paidAt.toISOString(),
            };
        }),
        entri.server(async (input) => {
            const row = await createLedgerEntryFor(actorId, input);
            return {
                tercatat: true,
                id: row.id,
                tipe: row.tipe,
                nominal: row.debit || row.kredit,
                keterangan: row.keterangan,
            };
        }),
    ];
}
