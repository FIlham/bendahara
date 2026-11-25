import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

/**
 * Definisi tool chatbot. Isomorphic (server + client): klien hanya butuh
 * definisi untuk kartu approval, eksekusi selalu di server.
 * Enum ditulis literal — jangan impor `@/db/kas-schema` di sini karena file itu
 * menarik drizzle-orm/pg-core ke bundle browser.
 */

const periodeId = z
    .string()
    .optional()
    .describe("ID periode; kosongkan untuk periode aktif");
const limit = z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe("Jumlah baris maksimal (default 20)");

export const ringkasanKeuanganDef = toolDefinition({
    name: "ringkasan_keuangan",
    description:
        "Saldo keseluruhan, pemasukan dan pengeluaran periode, nominal kas per anggota, jumlah anggota, dan daftar bendahara.",
    inputSchema: z.object({ periodeId }),
});

export const daftarPeriodeDef = toolDefinition({
    name: "daftar_periode",
    description:
        "Daftar periode kas (aktif dan arsip) beserta nomor, nominal, dan status.",
    inputSchema: z.object({}),
});

export const riwayatKasDef = toolDefinition({
    name: "riwayat_kas",
    description:
        "Riwayat setoran iuran kas: penyetor, nominal, metode, dan tanggal bayar.",
    inputSchema: z.object({
        periodeId,
        search: z.string().optional().describe("Cari nama atau email penyetor"),
        method: z.enum(["tunai", "non-tunai"]).optional(),
        from: z.string().optional().describe("Tanggal awal YYYY-MM-DD"),
        to: z.string().optional().describe("Tanggal akhir YYYY-MM-DD"),
        limit,
    }),
});

export const statusIuranDef = toolDefinition({
    name: "status_iuran",
    description:
        "Status iuran tiap anggota pada satu periode: total bayar, kurang, lunas atau belum.",
    inputSchema: z.object({ periodeId }),
});

export const bukuKeuanganDef = toolDefinition({
    name: "buku_keuangan",
    description:
        "Buku keuangan (ledger): keterangan, tipe masuk/keluar, debit, kredit, metode, dan tanggal.",
    inputSchema: z.object({
        periodeId,
        search: z.string().optional().describe("Cari keterangan"),
        tipe: z.enum(["masuk", "keluar"]).optional(),
        method: z.enum(["tunai", "transfer"]).optional(),
        from: z.string().optional().describe("Tanggal awal YYYY-MM-DD"),
        to: z.string().optional().describe("Tanggal akhir YYYY-MM-DD"),
        limit,
    }),
});

export const catatSetoranKasDef = toolDefinition({
    name: "catat_setoran_kas",
    description:
        "Usulkan pencatatan setoran iuran kas seorang anggota. Butuh persetujuan bendahara sebelum disimpan. " +
        "Pakai status_iuran untuk menemukan ID anggota (NIM) bila user hanya menyebut nama.",
    inputSchema: z.object({
        depositorUserId: z.string().describe("NIM/ID anggota penyetor"),
        amount: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Nominal; kosongkan untuk nominal kas periode aktif"),
        method: z.enum(["tunai", "non-tunai"]),
        paidAt: z
            .string()
            .optional()
            .describe("Tanggal bayar YYYY-MM-DD; kosongkan untuk hari ini"),
        reason: z.string().optional().describe("Catatan singkat untuk audit log"),
    }),
    needsApproval: true,
});

export const catatEntriKeuanganDef = toolDefinition({
    name: "catat_entri_keuangan",
    description:
        "Usulkan pencatatan entri manual buku keuangan (pemasukan atau pengeluaran di luar iuran). Butuh persetujuan bendahara.",
    inputSchema: z.object({
        keterangan: z.string().describe("Keterangan transaksi"),
        tipe: z.enum(["masuk", "keluar"]),
        amount: z.number().int().positive(),
        method: z.enum(["tunai", "transfer"]),
        tanggal: z
            .string()
            .optional()
            .describe("Tanggal YYYY-MM-DD; kosongkan untuk hari ini"),
        reason: z.string().describe("Alasan pencatatan untuk audit log"),
    }),
    needsApproval: true,
});

/** Tool baca — tersedia untuk semua role yang login. */
export const readTools = [
    ringkasanKeuanganDef,
    daftarPeriodeDef,
    riwayatKasDef,
    statusIuranDef,
    bukuKeuanganDef,
] as const;

/** Tool tulis — server hanya memasangnya bila role bendahara. */
export const writeTools = [catatSetoranKasDef, catatEntriKeuanganDef] as const;

/** Semua definisi, dipakai klien agar kartu approval punya tipe argumen. */
export const allToolDefs = [...readTools, ...writeTools];
