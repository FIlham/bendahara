import { createServerFn } from "@tanstack/react-start";
import type { GeminiTextModel } from "@tanstack/ai-gemini";

/** Konfigurasi Gemini. Opsional: tanpa key, halaman /chat menampilkan notice. */
export function aiConfig() {
    // Kill switch cepat tanpa deploy ulang saat kuota habis / ada penyalahgunaan.
    if (process.env.AI_DISABLED === "1") return null;
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return null;
    return {
        apiKey,
        model: (process.env.GEMINI_MODEL?.trim() ||
            "gemini-3.5-flash") as GeminiTextModel,
    };
}

export const getAiStatus = createServerFn({ method: "GET" }).handler(
    async () => aiConfig() !== null,
);

const BASE = `Kamu asisten keuangan kelas (bendahara kelas) berbahasa Indonesia.
Aturan:
- Semua angka harus berasal dari hasil tool. Jangan mengarang angka, nama, atau tanggal.
- Kumpulkan semua data yang dibutuhkan dalam satu putaran tool; jangan memanggil tool yang sama dua kali.
- Format uang dalam Rupiah, contoh Rp5.000.
- Jawab singkat dan langsung; sebutkan periode yang dipakai bila relevan.
- Bila data kosong, katakan datanya belum ada.
- Jangan pernah mengaku sudah menyimpan data sebelum tool tulis mengembalikan hasil sukses.`;

const READ_ONLY = `Kamu hanya punya akses baca. Bila user meminta mencatat atau mengubah data, jelaskan bahwa hanya bendahara yang bisa, lalu tawarkan untuk menunjukkan data yang ada.`;

const ASISTEN = `Kamu terhubung ke tool tulis. Sebelum mencatat, pastikan penyetor, nominal, dan metode jelas; tanyakan bila ragu, jangan menebak ID anggota.
Setiap tool tulis meminta persetujuan manusia, jadi jelaskan apa yang akan dicatat dan tunggu hasilnya.`;

export function systemPrompt(isBendahara: boolean) {
    return [
        BASE,
        isBendahara ? ASISTEN : READ_ONLY,
        `Tanggal hari ini: ${new Date().toISOString().slice(0, 10)}.`,
    ].join("\n\n");
}
