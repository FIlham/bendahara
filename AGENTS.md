# AGENTS.md

TanStack Start (React + Vite) on Bun. Counter demo from the build-from-scratch guide.

## Commands (use `bun`, not npm)

- Install: `bun install`
- Dev: `bun run dev` → http://localhost:3000
- Build: `bun run build` (also regenerates `src/routeTree.gen.ts`)
- Preview: `bun run preview`
- Start (output Nitro): `bun run start` (`node .output/server/index.mjs`)
- Typecheck: `bunx tsc --noEmit`
- Regen auth schema: `bun scripts/generate-auth-schema.ts` (after changing plugins/`additionalFields` in `src/lib/auth/server.ts`)
- DB migrate: `bun x drizzle-kit generate` then `bun x drizzle-kit migrate` (needs live `DATABASE_URL`)

## Structure

```
src/lib/
  auth/     # Better Auth: server.ts (instance), client.ts, functions.ts (guards)
  server/   # server functions + akses DB (kas, ledger, periode, activity, seed, env)
  shared/   # helper murni tanpa import server (validate, week, nim)
```

- `vite.config.ts` — `tanstackStart()` then `nitro()` before `viteReact()` (order matters; Nitro auto-detects Vercel preset saat deploy); path aliases via native `resolve.tsconfigPaths: true` (Vite 8, no plugin needed).
- `vercel.json` — `framework: tanstack-start`, install/build via bun. Node runtime dikunci `22.x` via `engines` di `package.json`.
- `src/router.tsx` — `createRouter({ routeTree, scrollRestoration: true, defaultStaleTime: 0, defaultPreloadStaleTime: 0 })`; imports generated `./routeTree.gen`.
- `src/routes/__root.tsx` — root document (`<HeadContent/>`, `<Outlet/>`, `<Scripts/>`); font lokal via `@fontsource-variable`, tanpa fetch Google Fonts.
- `src/routes/index.tsx` — `/` dashboard keuangan per periode (wajib login): pemilih periode + badge arsip, kartu saldo keseluruhan, rekap periode (masuk/keluar/ekspektasi `nominal × user` + progres), daftar bendahara, tabel ledger (tanggal, keterangan, debit, kredit, saldo running, metode) + filter auto-apply/debounce/reset + paginasi 10/halaman, form catat/ubah manual bendahara via tombol + floating dialog (periode aktif saja), `router.invalidate()` tiap mutasi.
- `src/routes/login.tsx` — `/login` Google-only (redirects to `/` if already signed in); no sign-up UI.
- `src/routes/bendahara.tsx` — `/bendahara` treasurer panel, guarded by `ensureBendahara`.
- `src/routes/kas.tsx` — `/kas` iuran per periode (semua role lihat; hanya bendahara catat/ubah + nominal + tutup minggu): pemilih periode + mode arsip read-only, kartu ringkasan, tabel status iuran per user (NIM, nama, target/terkumpul/kurang per-minggu reset, lunas, metode terakhir), dialog tambah via combobox live-search client-side (tanpa request per ketikan), `router.invalidate()` tiap mutasi.
- `src/routes/log.tsx` — `/log` audit trail terpadu (semua role): pills filter entitas auto-apply + limit (50/100/200), tabel desktop + kartu mobile, paginasi 15/halaman.
- `src/routes/chat.tsx` — `/chat` chatbot AI (semua role): non-bendahara hanya baca, bendahara dapat tool tulis yang wajib disetujui lewat kartu approval; riwayat chat hanya di state browser (tanpa tabel DB).
- `src/routes/api/chat.ts` — POST `/api/chat` (SSE) untuk `@tanstack/ai-react` `useChat`: session + role dibaca di server, tool dari `src/lib/server/ai-tools.ts`, model Gemini via `GEMINI_API_KEY`/`GEMINI_MODEL` (tanpa key atau `AI_DISABLED=1` → 503, halaman menampilkan notice). Hemat kuota free tier: riwayat 10 pesan, `maxIterations(3)`, `retry.maxRetries:0`, `maxOutputTokens:700`, body ≤ 20k char.
- `src/lib/server/ai-limit.ts` — kuota chatbot di tabel `ai_rate_limit` (jendela tetap 5 menit, upsert atomik sehingga aman multi-instance serverless): `AI_USER_PER_5MIN` (default 10) per user + `AI_GLOBAL_PER_DAY` (default 80) seluruh kelas; lewat batas → 429 + `Retry-After`. Approval resume ikut dihitung.
- `src/lib/server/kas.ts` — server functions iuran per periode: `listCashEntries` (validasi filter + limit server-side 500/2000), `getCashStats`, `getUserKasStatus` (per-minggu reset, tanpa carry-over; urut NIM via `src/lib/shared/nim.ts`), `listUsers` (urut NIM), `createCashEntry`/`updateCashEntry` (auto-posting ledger + `activity_log` atomik, update wajib `reason`, periode dikunci `FOR UPDATE` di dalam transaksi agar tulis ke arsip ditolak), `updateNominalKas` (nominal milik periode aktif, update + log dalam satu transaksi). Read path + write path auto-seed via `ensureKasDefaults` bila DB fresh. Tanpa Elysia, tanpa endpoint delete.
- `src/lib/server/ledger.ts` — server functions buku keuangan per periode: `listLedgerEntries` (validasi filter + limit server-side 1000/2000; saldo running dihitung dari baris lolos filter), `getDashboardData`, `createLedgerEntry`/`updateLedgerEntry` manual (bendahara, wajib alasan; baris auto hanya via kas; periode dikunci `FOR UPDATE` di dalam transaksi).
- `src/lib/server/periode.ts` — `listPeriodes`/`getActivePeriode` (auto-seed Periode 1 + setting default bila DB fresh)/`closeAndOpenPeriode` (bendahara, wajib alasan; baris aktif dikunci `FOR UPDATE` + partial unique index cegah dua periode aktif): snapshot rekap dibekukan, periode lama jadi arsip terkunci, periode baru nomor+1.
- `src/lib/server/kas-seed.ts` — `ensureKasDefaults(actorId)` idempoten (dipakai read + write path): seed `kas_setting[nominal_kas]=5000` dan `kas_periode` nomor 1 / nominal 5000 / status aktif bila kosong; `DEFAULT_NOMINAL_KAS` di `src/db/kas-schema.ts`.
- `src/lib/server/activity.ts` — `listActivityLogs` (filter entitas tervalidasi + limit 1–300, tolak key tak dikenal); pemilik tipe `LogChanges`.
- `src/lib/shared/validate.ts` — helper validasi runtime server functions (panjang search/reason/keterangan, enum, tanggal, batas nominal ≤ 100jt, limit list).
- `src/lib/shared/week.ts` — helper minggu WIB (`startOfWeekWIB`, `addWeeks`).
- `src/routes/api/$.ts` — Elysia app (`prefix: '/api'`, route id `/api/$`) mounted via `server.handlers`; `getTreaty` Eden client (`createIsomorphicFn`: direct call on server, HTTP via `window.location.origin` on client).
- `src/routes/api/auth/$.ts` — Better Auth handler (`auth.handler`, route id `/api/auth/$`, more specific than `/api/$` so auth paths win). Google-only, closed registration.
- `src/lib/auth/server.ts` — Better Auth instance (`drizzleAdapter`, `tanstackStartCookies()` last); env wajib divalidasi via `src/lib/server/env.ts` (`assertServerEnv`, gagal cepat bila kurang); `AppRole = "user" | "bendahara"`; `emailAndPassword` disabled; `socialProviders.google` with `disableSignUp: true`; `user.additionalFields.role` (default `"user"`, `input: false`); `user.validateUserInfo` allowlist (Plan A: only pre-registered emails link/sign in, else `user_not_registered`); `src/lib/auth/client.ts` — `createAuthClient()`; `src/lib/auth/functions.ts` — `getSession`/`ensureSession`/`ensureRole`/`ensureBendahara` server fns for `beforeLoad` guards.
- `src/lib/server/api.ts` — REST publik `/api/v1` (Elysia plugin, dipasang di `routes/api/$.ts`) untuk service pihak ketiga/AI agent. Auth `Authorization: Bearer <API_KEY>` + `API_ACTOR_ID` (env, opsional; tanpa dua-duanya → 503). GET: `/`, `/overview`, `/users`, `/kas`, `/kas/status`, `/ledger`, `/periode`. POST: `/kas` (default nominal periode aktif), `/ledger`; POST hanya untuk actor ber-role `bendahara`. Semua endpoint memanggil service function yang sama dengan web (validasi + audit + auto-posting tetap).
- `src/db/index.ts` — `pg` Pool + `drizzle-orm/node-postgres` (`DATABASE_URL` via `getEnv`, `max` dari `PGPOOL_MAX` default 5 + timeout; pakai endpoint pooler penyedia untuk serverless); `src/db/auth-schema.ts` — generated, never hand-edit; `src/db/kas-schema.ts` — hand-written tables + `check` (status/tipe/metode, nominal positif, debit-xor-kredit) + partial unique `kas_periode_single_active` + indeks `periodeId`/`sourceCashEntryId`/activity; `drizzle.config.ts` (schema: both files, `process.env.DATABASE_URL`) + `drizzle/` — drizzle-kit config and committed migrations.
- `src/routeTree.gen.ts` — auto-generated on `dev`/`build`. Never hand-edit.

## Conventions / gotchas

- `tsconfig.json` intentionally omits `verbatimModuleSyntax` — enabling it leaks server bundles into client bundles (per Start docs).
- Server functions (`createServerFn`) run on the server; keep `node:fs` access inside them, not in components. Importing `@tanstack/react-start/server` is only allowed in files containing `createServerFn` handlers — never in plain shared helpers imported by client code (build `import-protection` rejects it); keep guards inside handlers or duplicate the small `auth.api.getSession` pattern per functions file.
- Elysia: add routes on the `app` in `api/$.ts`; extend `server.handlers` with more HTTP methods as needed (currently GET/POST/PUT/PATCH/DELETE). Use `getTreaty()` in loaders/components for type-safe calls — server-side runs without HTTP overhead. Internal app CRUD (kas/ledger/log) uses server functions, not Elysia; the public bot API lives in `src/lib/server/api.ts` and is mounted as an Elysia plugin.
- Public API is opt-in via `API_KEY` + `API_ACTOR_ID`: write endpoints act as that user and require `bendahara`; keep the key secret because it can record payments. Reads go through the same service functions as the web (no separate query path).
- Counter demo removed: `/` is now the finance dashboard; `count.txt` is unused legacy runtime noise (untracked, don't commit).
- Deps use `bun add` (Bun auto-installs peers; the pnpm-only `@sinclair/typebox`/`openapi-types` workaround does not apply).
- Runtime noise is untracked, don't commit it: `count.txt` (counter state), `.tanstack/` (plugin cache). `dist/` is gitignored. Commit `drizzle/` migrations.
- Env (`.env`, gitignored, Bun autoloads; contoh di `.env.example`): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL` (postgres, `?sslmode=require` untuk serverless, pakai endpoint pooler), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (OAuth client untuk `bendahara-dev`; redirect URI `{BETTER_AUTH_URL}/api/auth/callback/google`), opsional `PGPOOL_MAX` (default 5), `API_KEY` + `API_ACTOR_ID` (mengaktifkan `/api/v1`), `GEMINI_API_KEY` + `GEMINI_MODEL` (default `gemini-3.5-flash`), `AI_USER_PER_5MIN` (10), `AI_GLOBAL_PER_DAY` (80), `AI_DISABLED` (isi `1` untuk mematikan chatbot).
- `@better-auth/core@1.7.6` is pinned as devDep: `@better-auth/cli` pulls core 1.4.x, and the hoisted stale core breaks the SSR bundle (`additionalAuthorizationParamsSchema` link error). Don't remove the pin.
- `pg` driver (not `bun:sqlite`) is intentional: keeps SSR runnable under plain Node (`vite dev`/`preview`), no `bun --bun` needed.
