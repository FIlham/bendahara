# Bendahara — Keuangan Kelas

Aplikasi web untuk mencatat dan memantau keuangan kelas: iuran kas mingguan per anggota, buku ledger (pemasukan/pengeluaran), penutupan periode mingguan dengan arsip terkunci, dan log audit transparan yang bisa dilihat semua anggota.

## Fitur

- **Dashboard (`/`)** — saldo keseluruhan, pemasukan bulan ini, rekap per periode (masuk/keluar/target), tabel ledger dengan filter + paginasi, form catat/ubah transaksi (bendahara, periode aktif saja).
- **Kas (`/kas`)** — ringkasan iuran, status bayar per anggota (target/terkumpul/kurang, reset tiap minggu), tambah pembayaran, atur nominal iuran, tutup minggu & buka periode baru.
- **Log (`/log`)** — audit trail semua perubahan (kas, nominal, ledger, periode) beserta alasan perubahannya.
- **Periode mingguan** — setiap minggu berdiri sendiri (tanpa carry-over). Periode yang ditutup menjadi arsip read-only dengan snapshot rekap yang dibekukan.
- **Akses tertutup** — login Google saja, dan hanya email yang sudah didaftarkan yang bisa masuk. Peran: `user` dan `bendahara`.

## Teknologi

TanStack Start (React + Vite) di atas Bun, Nitro untuk output deploy, PostgreSQL via Drizzle ORM + `pg`, Better Auth (Google OAuth), Tailwind CSS + shadcn.

## Mulai cepat (lokal)

```bash
bun install
cp .env.example .env   # lalu isi nilainya (lihat bawah)
bun x drizzle-kit migrate
bun run dev            # http://localhost:3000
```

Perintah lain:

| Perintah | Fungsi |
|---|---|
| `bun run build` | Build production (output Nitro di `.output/`) |
| `bun run start` | Jalankan hasil build (`node .output/server/index.mjs`) |
| `bun run preview` | Preview hasil build via Vite |
| `bunx tsc --noEmit` | Cek tipe |
| `bun x drizzle-kit generate` | Buat file migrasi baru setelah ubah skema |
| `bun x drizzle-kit migrate` | Jalankan migrasi ke database |

## Konfigurasi environment

Salin `.env.example` ke `.env` dan isi:

| Variabel | Keterangan |
|---|---|
| `BETTER_AUTH_SECRET` | String acak panjang untuk enkripsi sesi |
| `BETTER_AUTH_URL` | URL publik aplikasi, tanpa garis miring di akhir (lokal: `http://localhost:3000`) |
| `DATABASE_URL` | Connection string PostgreSQL (untuk serverless pakai endpoint pooler + `?sslmode=require` bila perlu) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Dari Google Cloud Console; redirect URI yang didaftarkan harus persis `{BETTER_AUTH_URL}/api/auth/callback/google` |
| `PGPOOL_MAX` | Opsional, batas koneksi per instance (default `5`) |

> Jangan beri prefix `VITE_` pada variabel di atas — itu akan membocorkannya ke browser.

## Daftarkan pengguna pertama

Tidak ada halaman pendaftaran: pengguna hanya bisa login jika emailnya **sudah ada** di tabel `user`. Minimal satu pengguna harus berperan `bendahara`, kalau tidak tidak ada yang bisa mencatat apa pun. Insert langsung via SQL:

```sql
insert into "user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
values ('240123456', 'Nama Bendahara', 'nama@gmail.com', true, 'bendahara', now(), now());
```

- `id` dipakai sebagai NIM (diurutkan kecil-ke-besar di tampilan), jadi isi dengan NIM asli.
- Anggota biasa: sama seperti di atas dengan `role = 'user'`.
- Periode kas pertama (Minggu 1, nominal Rp5.000) dibuat otomatis saat aplikasi pertama kali diakses.

## Deploy ke Vercel

1. Commit dan push repo ini ke GitHub (`.env` sudah di-ignore, jangan ikut).
2. Jalankan migrasi ke database production:
   ```bash
   DATABASE_URL="<url-pooler-production>" bun x drizzle-kit migrate
   ```
3. Import repo di Vercel dan isi Environment Variables (Production + Preview): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (= domain production), `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (opsional `API_KEY`, `API_ACTOR_ID` untuk bot).
4. Di Google Cloud Console, tambahkan redirect URI production: `https://<domain-anda>/api/auth/callback/google`.
5. Deploy, lalu smoke test: login → catat kas → ubah ledger → tutup periode → periksa `/log`.

## API untuk bot / AI agent

API JSON tersedia di `/api/v1` (opt-in). Isi `API_KEY` dan `API_ACTOR_ID` di environment; tanpa keduanya endpoint menjawab 503. Bot memanggil dengan:

```bash
curl -H "Authorization: Bearer $API_KEY" "https://<domain>/api/v1/overview"
```

- Baca: `GET /overview`, `/users`, `/kas`, `/kas/status`, `/ledger`, `/periode`.
- Tulis (actor harus bendahara): `POST /kas`, `POST /ledger`.
- `GET /api/v1/` mengembalikan daftar endpoint + parameter.
- Semua aksi tulis tetap masuk `activity_log` dan memakai validasi yang sama dengan web. Tidak ada endpoint edit/hapus/tutup periode.

## Struktur singkat

- `src/routes/` — halaman (`index.tsx` dashboard, `kas.tsx`, `log.tsx`, `bendahara.tsx`, `login.tsx`).
- `src/lib/server/` — server functions (kas, ledger, periode, activity), seed, dan env.
- `src/lib/shared/` — helper murni (validasi runtime, minggu WIB, urutan NIM).
- `src/lib/auth/` — konfigurasi Better Auth, client, dan guard sesi.
- `src/db/` — skema database (`kas-schema.ts` ditulis manual, `auth-schema.ts` hasil generate — jangan edit manual) dan koneksi pool.
- `drizzle/` — file migrasi yang ter-commit; jalankan di production secara terencana.
- `vercel.json` — deklarasi framework `tanstack-start` untuk deploy.
