import { useEffect, useRef, useState } from "react";
import {
    createFileRoute,
    redirect,
    useRouter,
    Link,
} from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { ensureSession } from "@/lib/auth.functions";
import {
    getActivePeriode,
    listPeriodes,
} from "@/lib/periode.functions";
import {
    createLedgerEntry,
    getDashboardData,
    listLedgerEntries,
    updateLedgerEntry,
    type LedgerFilter,
    type LedgerMethod,
    type LedgerTipe,
} from "@/lib/ledger.functions";
import {
    Card,
    Button,
    Field,
    FieldsetRow,
    inputClass,
    pageShell,
    selectClass,
    tableClass,
    tableShell,
    tdClass,
    theadClass,
    thClass,
    trClass,
} from "@/components/ui";

const navClass =
    "rounded-full px-3 py-2 text-button-sm font-medium text-foreground transition-colors hover:bg-muted hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-[#ff6680]/50";

const darkInputClass =
    `${inputClass} dark:border-border dark:bg-input dark:text-foreground dark:placeholder:text-muted-foreground dark:focus:border-[#ff6680] dark:focus:ring-[#ff6680]/30`;
const darkSelectClass =
    `${selectClass} dark:border-border dark:bg-input dark:text-foreground dark:focus:border-[#ff6680] dark:focus:ring-[#ff6680]/30`;

export const Route = createFileRoute("/")({
    beforeLoad: async () => {
        try {
            await ensureSession();
        } catch {
            throw redirect({ to: "/login" });
        }
    },
    loader: async () => {
        const [periodes, active] = await Promise.all([
            listPeriodes(),
            getActivePeriode(),
        ]);
        const pid = active?.id ?? periodes[0]?.id;
        const monthRange = getCurrentMonthRange();
        const [dashboard, ledger, monthEntries] = await Promise.all([
            getDashboardData({ data: pid ? { periodeId: pid } : {} }),
            listLedgerEntries({ data: pid ? { periodeId: pid } : {} }),
            listLedgerEntries({
                data: { from: monthRange.from, to: monthRange.to, tipe: "masuk" },
            }),
        ]);
        return {
            periodes,
            selectedId: pid ?? "",
            dashboard,
            ledger,
            monthIncome: monthEntries.reduce((total, row) => total + row.debit, 0),
        };
    },
    component: Dashboard,
});

function getCurrentMonthRange() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
        from: monthStart.toISOString(),
        to: now.toISOString(),
        label: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(now),
    };
}

const rupiah = (n: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(n);

const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });

function Dashboard() {
    const router = useRouter();
    const loaded = Route.useLoaderData();
    const { data: session } = authClient.useSession();
    const role = (session?.user as { role?: string } | undefined)?.role ?? "user";
    const isBendahara = role === "bendahara";

    const [periodes] = useState(loaded.periodes);
    const [selectedId, setSelectedId] = useState(loaded.selectedId);
    const [dashboard, setDashboard] = useState(loaded.dashboard);
    const [rows, setRows] = useState(loaded.ledger);
    const [monthIncome, setMonthIncome] = useState(loaded.monthIncome);
    const [filter, setFilter] = useState<LedgerFilter>({ sort: "desc" });
    const [error, setError] = useState("");
    const [isEntryOpen, setIsEntryOpen] = useState(false);

    // Pagination laporan keuangan: maksimal 10 baris per halaman.
    const PAGE_SIZE = 10;
    const [page, setPage] = useState(0);
    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const pagedRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
    const rangeStart = rows.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
    const rangeEnd = Math.min(rows.length, safePage * PAGE_SIZE + PAGE_SIZE);

    const [keterangan, setKeterangan] = useState("");
    const [tipe, setTipe] = useState<LedgerTipe>("keluar");
    const [amount, setAmount] = useState("");
    const [method, setMethod] = useState<LedgerMethod>("tunai");
    const [tanggal, setTanggal] = useState("");
    const [reason, setReason] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);

    const isActive = dashboard.periode.status === "aktif";

    const refresh = async (f: LedgerFilter, pid: string, updateMonth = false) => {
        const monthRange = getCurrentMonthRange();
        const [d, l, monthEntries] = await Promise.all([
            getDashboardData({ data: { periodeId: pid } }),
            listLedgerEntries({ data: { ...f, periodeId: pid } }),
            updateMonth
                ? listLedgerEntries({
                    data: { from: monthRange.from, to: monthRange.to, tipe: "masuk" },
                })
                : Promise.resolve(null),
        ]);
        setDashboard(d);
        setRows(l);
        setPage(0);
        if (monthEntries) {
            setMonthIncome(monthEntries.reduce((total, row) => total + row.debit, 0));
        }
    };

    const runFilter = (next: LedgerFilter, pid: string = selectedId) => {
        setError("");
        refresh(next, pid).catch((e) =>
            setError(e instanceof Error ? e.message : "Gagal memuat data"),
        );
    };

    // Pencarian terapkan otomatis (debounce); select/tanggal terapkan langsung
    // dari handler-nya masing-masing.
    const appliedSearch = useRef(filter.search ?? "");
    useEffect(() => {
        if ((filter.search ?? "") === appliedSearch.current) return;
        const snapshot = filter;
        const t = window.setTimeout(() => {
            appliedSearch.current = snapshot.search ?? "";
            runFilter(snapshot);
        }, 450);
        return () => window.clearTimeout(t);
    }, [filter]);

    // Kunci scroll + Escape untuk dialog catat keuangan.
    useEffect(() => {
        if (!isEntryOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") resetForm();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [isEntryOpen]);

    const changePeriode = (pid: string) => {
        setSelectedId(pid);
        setError("");
        refresh({ ...filter, periodeId: undefined }, pid).catch((e) =>
            setError(e instanceof Error ? e.message : "Gagal memuat data"),
        );
    };

    const resetForm = () => {
        setKeterangan("");
        setTipe("keluar");
        setAmount("");
        setMethod("tunai");
        setTanggal("");
        setReason("");
        setEditingId(null);
        setIsEntryOpen(false);
    };

    const submitEntry = async () => {
        setError("");
        try {
            if (!reason.trim()) {
                setError("Alasan wajib diisi");
                return;
            }
            if (editingId) {
                await updateLedgerEntry({
                    data: {
                        id: editingId,
                        keterangan,
                        amount: Number(amount),
                        method,
                        ...(tanggal ? { tanggal } : {}),
                        reason,
                    },
                });
            } else {
                await createLedgerEntry({
                    data: {
                        keterangan,
                        tipe,
                        amount: Number(amount),
                        method,
                        ...(tanggal ? { tanggal } : {}),
                        reason,
                    },
                });
            }
            resetForm();
            await refresh(filter, selectedId, true);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Gagal menyimpan");
        }
        // Selalu invalidasi (di luar try refresh) agar kas/log ikut segar
        // walau refresh lokal gagal.
        await router.invalidate().catch(() => {});
    };

    const startEdit = (id: string) => {
        const row = rows.find((r) => r.id === id);
        if (!row || row.auto) return;
        setEditingId(id);
        setKeterangan(row.keterangan);
        setAmount(String(row.tipe === "masuk" ? row.debit : row.kredit));
        setMethod(row.method as LedgerMethod);
        setTanggal(new Date(row.tanggal).toISOString().slice(0, 10));
        setReason("");
        setError("");
        setIsEntryOpen(true);
    };

    const progress =
        dashboard.ekspektasiPeriode > 0
            ? Math.round(
                (dashboard.masukPeriode / dashboard.ekspektasiPeriode) * 100,
            )
            : 0;

    return (
        <main id="main-content" className={`${pageShell} bg-background text-foreground`}>
            <header className="mb-7 flex flex-col items-start justify-between gap-5 sm:mb-9 sm:flex-row sm:items-end">
                <div>
                    <h1 className="font-display-xl text-display-xl tracking-tight text-foreground sm:text-[32px]">
                        2026B M.I - UNAIR
                    </h1>
                    <p className="mt-2 text-body-md text-muted-foreground">
                        Cek kas keuangan dengan visual mudah.
                    </p>
                </div>
                <Link
                    to="/kas"
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#ff6680]/40 bg-[#ff6680] px-5 py-2.5 text-button-sm font-semibold text-[#24151a] transition-colors hover:bg-[#ff8197] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6680]/50"
                >
                    Lihat kas
                </Link>
            </header>

            <nav
                aria-label="Navigasi utama"
                className="mb-8 flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border py-3"
            >
                {session?.user.email && (
                    <span className="text-caption-sm text-muted-foreground">
                        {session.user.email} ({role})
                    </span>
                )}
                <span aria-hidden="true" className="text-muted-foreground/50">|</span>
                <div className="flex flex-wrap items-center gap-1">
                    <Link to="/kas" className={navClass}>Kas</Link>
                    <Link to="/log" className={navClass}>Log</Link>
                    {isBendahara && <Link to="/bendahara" className={navClass}>Bendahara</Link>}
                </div>
            </nav>

            {dashboard.periode.status !== "aktif" && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-badge text-muted-foreground">
                        Arsip
                    </span>
                    <p className="rounded-lg border border-border bg-card px-4 py-3 text-body-sm text-muted-foreground">
                        Periode ini hanya bisa dilihat. Menampilkan minggu {dashboard.periode.nomor}.
                    </p>
                </div>
            )}

            <section
                aria-label="Ringkasan keuangan"
                className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-6"
            >
                <Card className="min-h-48 border-border bg-card p-6 dark:bg-[#302128] dark:border-[#ff6680]/25 md:col-span-3 md:p-7">
                    <p className="text-caption font-medium text-foreground/80">Total uang saat ini</p>
                    <p className="mt-5 break-words text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl">
                        {rupiah(dashboard.saldo)}
                    </p>
                    <p className="mt-2 text-caption-sm text-muted-foreground">
                        Saldo kas keseluruhan yang tercatat
                    </p>
                </Card>
                <Card className="min-h-48 border-border bg-card p-6 dark:bg-[#202124] md:col-span-3 md:p-7">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-caption font-medium text-foreground/80">Pemasukan bulan ini</p>
                        <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-badge text-muted-foreground">
                            {getCurrentMonthRange().label}
                        </span>
                    </div>
                    <p className="mt-5 break-words text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl">
                        {rupiah(monthIncome)}
                    </p>
                    <p className="mt-2 text-caption-sm text-muted-foreground">
                        Akumulasi transaksi masuk pada bulan berjalan
                    </p>
                </Card>
                <Card className="border-border bg-card md:col-span-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                                <h2 className="text-title-md text-foreground">Bendahara</h2>
                                <p className="mt-1 text-caption-sm text-muted-foreground">Pengelola kas kelas</p>
                        </div>
                        {dashboard.bendaharaList.length > 0 ? (
                            <ul className="grid w-full grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 md:max-w-3xl md:grid-cols-3">
                                {dashboard.bendaharaList.map((bendahara) => (
                                        <li key={bendahara.id} className="min-w-0 border-l-2 border-[#ff6680]/70 pl-3">
                                            <p className="truncate text-body-sm font-medium text-foreground">
                                            {bendahara.name}
                                        </p>
                                            <p className="truncate text-caption-sm text-muted-foreground">
                                            {bendahara.email}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                                <p className="text-body-sm text-muted-foreground">Belum ada bendahara terdaftar.</p>
                        )}
                    </div>
                </Card>
            </section>

            <div className="mt-4 rounded-card border border-border bg-card px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-6">
                <p className="text-caption-sm leading-relaxed text-muted-foreground">
                    Periode {dashboard.periode.nomor}: masuk {rupiah(dashboard.masukPeriode)}, keluar {rupiah(dashboard.keluarPeriode)}.
                    {" "}Target iuran {rupiah(dashboard.ekspektasiPeriode)} dari {dashboard.userCount} anggota.
                </p>
                <div className="mt-3 flex shrink-0 items-center gap-3 sm:mt-0">
                    <span className="text-caption-sm font-medium text-foreground">{progress}% terkumpul</span>
                    <div className="w-24">
                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.max(0, Math.min(100, progress))} aria-valuemin={0} aria-valuemax={100} aria-label="Progres terkumpul">
                            <div className="h-full rounded-full bg-[#ff6680]" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                        </div>
                    </div>
                </div>
            </div>


            <section className="mt-12 sm:mt-16">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-display-md tracking-tight text-foreground">Laporan Keuangan</h2>
                        <p className="mt-1 max-w-[65ch] text-body-sm text-muted-foreground">
                            Periode {dashboard.periode.nomor}. Pilih periode atau saring transaksi.
                        </p>
                    </div>
                    <label className="inline-flex items-center gap-2">
                        <span className="text-caption text-foreground/80">Periode</span>
                        <select value={selectedId} onChange={(event) => changePeriode(event.target.value)} className={`${darkSelectClass} w-auto min-h-11 min-w-[12rem] rounded-full pr-10`}>
                            {periodes.map((periode) => (
                                <option key={periode.id} value={periode.id}>
                                    Minggu {periode.nomor}{periode.status !== "aktif" ? " (arsip)" : ""}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="mb-5 grid grid-cols-2 gap-3 rounded-card border border-border bg-muted/60 p-3 sm:grid-cols-3 lg:grid-cols-6">
                    <label className="col-span-2 block sm:col-span-2 lg:col-span-2">
                        <span className="mb-1 block text-caption-sm font-medium text-foreground/80">Cari keterangan</span>
                        <input
                            placeholder="Contoh: iuran atau ATK (otomatis)"
                            aria-label="Cari keterangan"
                            value={filter.search ?? ""}
                            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                            className={darkInputClass}
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-caption-sm font-medium text-foreground/80">Jenis</span>
                        <select
                            aria-label="Filter tipe"
                            value={filter.tipe ?? "semua"}
                            onChange={(e) => {
                                const next = {
                                    ...filter,
                                    tipe: e.target.value as LedgerFilter["tipe"],
                                };
                                setFilter(next);
                                runFilter(next);
                            }}
                            className={darkSelectClass}
                        >
                            <option value="semua">masuk + keluar</option>
                            <option value="masuk">masuk</option>
                            <option value="keluar">keluar</option>
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-caption-sm font-medium text-foreground/80">Metode</span>
                        <select
                            aria-label="Filter metode"
                            value={filter.method ?? "semua"}
                            onChange={(e) => {
                                const next = {
                                    ...filter,
                                    method: e.target.value as LedgerFilter["method"],
                                };
                                setFilter(next);
                                runFilter(next);
                            }}
                            className={darkSelectClass}
                        >
                            <option value="semua">semua metode</option>
                            <option value="tunai">tunai</option>
                            <option value="transfer">transfer</option>
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-caption-sm font-medium text-foreground/80">Urutan</span>
                        <select
                            aria-label="Urutan"
                            value={filter.sort ?? "desc"}
                            onChange={(e) => {
                                const next = {
                                    ...filter,
                                    sort: e.target.value as "asc" | "desc",
                                };
                                setFilter(next);
                                runFilter(next);
                            }}
                            className={darkSelectClass}
                        >
                            <option value="desc">terbaru</option>
                            <option value="asc">terlama</option>
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-caption-sm font-medium text-foreground/80">Dari tanggal</span>
                        <input
                            type="date"
                            aria-label="Dari tanggal"
                            value={filter.from ?? ""}
                            onChange={(e) => {
                                const next = { ...filter, from: e.target.value };
                                setFilter(next);
                                runFilter(next);
                            }}
                            className={darkInputClass}
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-caption-sm font-medium text-foreground/80">Sampai tanggal</span>
                        <input
                            type="date"
                            aria-label="Sampai tanggal"
                            value={filter.to ?? ""}
                            onChange={(e) => {
                                const next = { ...filter, to: e.target.value };
                                setFilter(next);
                                runFilter(next);
                            }}
                            className={darkInputClass}
                        />
                    </label>
                    <Button type="button" variant="secondary" onClick={() => {
                        const next: LedgerFilter = { sort: "desc" };
                        appliedSearch.current = "";
                        setFilter(next);
                        runFilter(next);
                    }} className="col-span-2 self-end border-border bg-card text-foreground hover:bg-muted dark:border-border dark:bg-card dark:text-foreground sm:col-span-1">
                        Reset
                    </Button>
                </div>
                {error && (
                    <p role="alert" className="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-body-sm font-medium text-red-200">
                        {error}
                    </p>
                )}

                <p className="mb-3 text-caption-sm text-muted-foreground" aria-live="polite">
                    {rows.length === 0
                        ? "Belum ada transaksi yang sesuai"
                        : `Menampilkan ${rangeStart}–${rangeEnd} dari ${rows.length} transaksi`}
                </p>

                <div className={`${tableShell} hidden border-border bg-card shadow-none dark:border-border dark:bg-card dark:shadow-none md:block`}>
                    <table className={`${tableClass} min-w-[760px]`}>
                        <caption className="sr-only">
                            Tabel keuangan periode berjalan
                        </caption>
                        <thead className={`${theadClass} dark:bg-muted dark:text-muted-foreground`}>
                            <tr>
                                <th scope="col" className={thClass}>Tanggal</th>
                                <th scope="col" className={thClass}>Keterangan</th>
                                <th scope="col" className={`${thClass} text-right`}>Debit</th>
                                <th scope="col" className={`${thClass} text-right`}>Kredit</th>
                                <th scope="col" className={`${thClass} text-right`}>Saldo</th>
                                <th scope="col" className={thClass}>Metode</th>
                                {isBendahara && isActive && (
                                    <th scope="col" className={thClass}>Aksi</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {pagedRows.length === 0 && (
                                <tr>
                                    <td colSpan={isBendahara && isActive ? 7 : 6} className="px-5 py-8 text-center text-body-sm text-muted-foreground">
                                        Belum ada transaksi yang sesuai. Ubah filter untuk melihat data lain.
                                    </td>
                                </tr>
                            )}
                            {pagedRows.map((r) => (
                                <tr key={r.id} className={`${trClass} border-border dark:border-border dark:hover:bg-muted/70`}>
                                    <td className={`${tdClass} text-foreground`}>{fmtDate(r.tanggal)}</td>
                                    <td className={tdClass}>
                                        <span className="text-foreground">{r.keterangan}</span>
                                        {r.auto && (
                                            <span className="ml-1 text-caption-sm text-muted-foreground">
                                                · iuran otomatis
                                            </span>
                                        )}
                                    </td>
                                    <td className={`${tdClass} text-right text-foreground tabular-nums`}>
                                        {r.debit ? rupiah(r.debit) : "-"}
                                    </td>
                                    <td className={`${tdClass} text-right text-foreground tabular-nums`}>
                                        {r.kredit ? rupiah(r.kredit) : "-"}
                                    </td>
                                    <td className={`${tdClass} text-right font-semibold tabular-nums text-foreground`}>
                                        {rupiah(r.saldo)}
                                    </td>
                                    <td className={`${tdClass} text-foreground`}>{r.method}</td>
                                    {isBendahara && isActive && (
                                        <td className={tdClass}>
                                            {!r.auto && (
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(r.id)}
                                                    className="rounded-full border border-border bg-muted px-3 py-1.5 text-button-sm font-medium text-foreground transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-[#ff6680]/50 focus-visible:outline-none"
                                                >
                                                    Ubah
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="space-y-3 md:hidden">
                    {pagedRows.length === 0 ? (
                        <div className="rounded-card border border-dashed border-border bg-card px-4 py-8 text-center text-body-sm text-muted-foreground">
                            Belum ada transaksi yang sesuai. Ubah filter untuk melihat data lain.
                        </div>
                    ) : (
                        pagedRows.map((row) => {
                            const isIncome = row.tipe === "masuk";
                            return (
                                <article key={row.id} className="rounded-card border border-border bg-card p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="break-words text-body-sm font-semibold text-foreground">{row.keterangan}</p>
                                            <p className="mt-1 text-caption-sm text-muted-foreground">{fmtDate(row.tanggal)} · {row.method}</p>
                                        </div>
                                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-badge ${isIncome ? "border-[#ff6680]/40 bg-[#ff6680]/15 text-[#ff91a5]" : "border-border bg-muted text-muted-foreground"}`}>
                                        {isIncome ? "Masuk" : "Keluar"}
                                    </span>
                                    </div>
                                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-3">
                                        <div>
                                            <p className="text-caption-sm text-muted-foreground">{row.auto ? "Iuran kas otomatis" : "Saldo setelah transaksi"}</p>
                                            <p className="mt-1 text-caption font-medium text-foreground tabular-nums">{rupiah(row.saldo)}</p>
                                        </div>
                                        <p className={`text-body-sm font-semibold tabular-nums ${isIncome ? "text-[#ff91a5]" : "text-foreground"}`}>
                                            {isIncome ? "+" : "−"}{rupiah(isIncome ? row.debit : row.kredit)}
                                        </p>
                                    </div>
                                    {isBendahara && isActive && !row.auto && (
                                        <div className="mt-3 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => startEdit(row.id)}
                                                className="rounded-lg border border-border bg-muted px-3 py-2 text-button-sm font-medium text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6680]/50"
                                            >
                                                Ubah transaksi
                                            </button>
                                        </div>
                                    )}
                                </article>
                            );
                        })
                    )}
                </div>

                {pageCount > 1 && (
                    <nav aria-label="Navigasi halaman transaksi" className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-caption-sm text-muted-foreground tabular-nums">
                            Halaman {safePage + 1} dari {pageCount}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={safePage === 0}
                                className="border-border bg-card px-4 text-foreground hover:bg-muted dark:border-border dark:bg-card dark:text-foreground"
                            >
                                ← Sebelumnya
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                                disabled={safePage >= pageCount - 1}
                                className="border-border bg-card px-4 text-foreground hover:bg-muted dark:border-border dark:bg-card dark:text-foreground"
                            >
                                Berikutnya →
                            </Button>
                        </div>
                    </nav>
                )}
            </section>

            {isBendahara && isActive && (
                <button
                    type="button"
                    onClick={() => {
                        resetForm();
                        setIsEntryOpen(true);
                    }}
                    aria-label="Catat keluar/masuk uang"
                    title="Catat keluar/masuk uang"
                    className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#ff6680] text-3xl font-light leading-none text-[#24151a] shadow-[0_10px_30px_rgba(255,102,128,0.28)] transition-transform hover:scale-105 hover:bg-[#ff8197] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ff6680]/40 sm:bottom-8 sm:right-8 sm:h-16 sm:w-16"
                >
                    <span aria-hidden="true">+</span>
                </button>
            )}

            {isBendahara && isActive && isEntryOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) resetForm();
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="ledger-entry-title"
                        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-border bg-card p-5 text-foreground shadow-2xl sm:rounded-2xl sm:p-7"
                    >
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#ff8197]">
                                    Minggu {dashboard.periode.nomor}
                                </p>
                                <h2 id="ledger-entry-title" className="mt-1 text-xl font-semibold">
                                    {editingId ? "Ubah catatan keuangan" : "Catat keluar/masuk uang"}
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Iuran kas terposting otomatis. Form ini untuk pengeluaran dan pemasukan lain.
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label="Tutup formulir"
                                onClick={resetForm}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6680]/50"
                            >
                                ×
                            </button>
                        </div>
                        <FieldsetRow>
                            <Field label="Keterangan" className="dark:[&>span:first-child]:text-foreground/80">
                                <input
                                    value={keterangan}
                                    onChange={(e) => setKeterangan(e.target.value)}
                                    placeholder="cth: beli ATK"
                                    className={darkInputClass}
                                />
                            </Field>
                            <Field label="Tipe" className="dark:[&>span:first-child]:text-foreground/80">
                                <select
                                    value={tipe}
                                    onChange={(e) => setTipe(e.target.value as LedgerTipe)}
                                    disabled={!!editingId}
                                    className={darkSelectClass}
                                >
                                    <option value="keluar">keluar (kredit)</option>
                                    <option value="masuk">masuk (debit)</option>
                                </select>
                            </Field>
                            <Field label="Nominal (Rp)" className="dark:[&>span:first-child]:text-foreground/80">
                                <input
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    inputMode="numeric"
                                    className={darkInputClass}
                                />
                            </Field>
                            <Field label="Metode" className="dark:[&>span:first-child]:text-foreground/80">
                                <select
                                    value={method}
                                    onChange={(e) => setMethod(e.target.value as LedgerMethod)}
                                    className={darkSelectClass}
                                >
                                    <option value="tunai">tunai</option>
                                    <option value="transfer">transfer</option>
                                </select>
                            </Field>
                            <Field label="Tanggal (default hari ini)" className="dark:[&>span:first-child]:text-foreground/80">
                                <input
                                    type="date"
                                    value={tanggal}
                                    onChange={(e) => setTanggal(e.target.value)}
                                    className={darkInputClass}
                                />
                            </Field>
                            <Field
                                label="Alasan (wajib, tercatat di log)"
                                className="sm:col-span-2 lg:col-span-3 dark:[&>span:first-child]:text-foreground/80"
                            >
                                <input
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className={darkInputClass}
                                />
                            </Field>
                        </FieldsetRow>
                        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <Button type="button" variant="secondary" onClick={resetForm} className="border-border bg-muted text-foreground hover:bg-muted/70 dark:border-border dark:bg-muted dark:text-foreground">
                                Batal
                            </Button>
                            <Button type="button" onClick={submitEntry} className="bg-[#ff6680] text-[#24151a] hover:bg-[#ff8197] focus-visible:ring-[#ff6680]/50 dark:bg-[#ff6680] dark:text-[#24151a] dark:hover:bg-[#ff8197]">
                                {editingId ? "Simpan perubahan" : "Tambah"}
                            </Button>
                        </div>
                    </section>
                </div>
            )}

            <div className="mt-8">
                <Button
                    variant="quiet"
                    type="button"
                    onClick={async () => {
                        await authClient.signOut();
                        router.navigate({ to: "/login" });
                    }}
                    className="bg-muted text-foreground hover:bg-muted/70 dark:bg-muted dark:text-foreground"
                >
                    Sign out
                </Button>
            </div>
        </main>
    );
}
