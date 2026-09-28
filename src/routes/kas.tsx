import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
    createFileRoute,
    Link,
    Outlet,
    redirect,
    useRouter,
    useRouterState,
} from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { ensureSession } from "@/lib/auth.functions";
import {
    closeAndOpenPeriode,
    getActivePeriode,
    listPeriodes,
} from "@/lib/periode.functions";
import {
    createCashEntry,
    getCashStats,
    getUserKasStatus,
    listUsers,
    updateNominalKas,
    type CashMethod,
} from "@/lib/kas.functions";
import {
    Button,
    EmptyRow,
    ErrorAlert,
    Field,
    PeriodeSelect,
    Section,
    StatCard,
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
    "rounded-full px-3 py-2 text-button-sm font-medium text-foreground transition-colors hover:bg-muted hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6680]/50";
const darkInputClass = `${inputClass} dark:border-border dark:bg-input dark:text-foreground dark:placeholder:text-muted-foreground dark:focus:border-[#ff6680] dark:focus:ring-[#ff6680]/30`;
const darkSelectClass = `${selectClass} dark:border-border dark:bg-input dark:text-foreground dark:focus:border-[#ff6680] dark:focus:ring-[#ff6680]/30`;

export const Route = createFileRoute("/kas")({
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
        const pid = active?.id ?? periodes[0]?.id ?? "";
        const [stats, status] = await Promise.all([
            getCashStats({ data: pid ? { periodeId: pid } : {} }),
            getUserKasStatus({ data: pid ? { periodeId: pid } : {} }),
        ]);
        let users: { id: string; name: string; email: string }[] = [];
        try {
            users = await listUsers();
        } catch {
            // Member accounts cannot access the bendahara-only user list.
        }
        return { periodes, selectedId: pid, stats, status, users };
    },
    component: Kas,
});

const rupiah = (n: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(n);

function Kas() {
    const router = useRouter();
    const isPaymentRoute = useRouterState({
        select: (state) => state.location.pathname === "/kas/bayar",
    });
    const loaded = Route.useLoaderData();
    const { data: session } = authClient.useSession();
    const role = (session?.user as { role?: string } | undefined)?.role ?? "user";
    const isBendahara = role === "bendahara";

    const [periodes, setPeriodes] = useState(loaded.periodes);
    const [selectedId, setSelectedId] = useState(loaded.selectedId);
    const [stats, setStats] = useState(loaded.stats);
    const [status, setStatus] = useState(loaded.status);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [pageError, setPageError] = useState("");
    const [success, setSuccess] = useState("");
    const [depositor, setDepositor] = useState("");
    const [depositorQuery, setDepositorQuery] = useState("");
    const [depositorOpen, setDepositorOpen] = useState(false);
    const [amount, setAmount] = useState("");
    const [method, setMethod] = useState<CashMethod>("tunai");
    const [paidAt, setPaidAt] = useState("");
    const [reason, setReason] = useState("");
    const [nominal, setNominal] = useState(String(loaded.stats.nominalKas));
    const [closeReason, setCloseReason] = useState("");

    const isActive = stats.periode.status === "aktif";

    // Live search penyetor dari daftar loader (tanpa request DB per ketikan).
    const selectedDepositor = loaded.users.find((u) => u.id === depositor) ?? null;
    const depositorMatches = useMemo(() => {
        const q = depositorQuery.trim().toLowerCase();
        const list = q
            ? loaded.users.filter(
                (u) =>
                    u.name.toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q) ||
                    u.id.toLowerCase().includes(q),
            )
            : loaded.users;
        return list.slice(0, 8);
    }, [depositorQuery, loaded.users]);

    const pickDepositor = (id: string) => {
        setDepositor(id);
        setDepositorQuery("");
        setDepositorOpen(false);
    };

    useEffect(() => {
        if (!isAddOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !isSaving) setIsAddOpen(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [isAddOpen, isSaving]);

    useEffect(() => {
        if (!success) return;
        const timeout = window.setTimeout(() => setSuccess(""), 5000);
        return () => window.clearTimeout(timeout);
    }, [success]);

    const refresh = async (pid: string) => {
        const [nextStats, nextStatus] = await Promise.all([
            getCashStats({ data: { periodeId: pid } }),
            getUserKasStatus({ data: { periodeId: pid } }),
        ]);
        setStats(nextStats);
        setStatus(nextStatus);
        setNominal(String(nextStats.nominalKas));
    };

    const changePeriode = (pid: string) => {
        setSelectedId(pid);
        setPageError("");
        refresh(pid).catch((error: unknown) =>
            setPageError(error instanceof Error ? error.message : "Gagal memuat data"),
        );
    };

    const resetEntryForm = () => {
        setDepositor("");
        setDepositorQuery("");
        setDepositorOpen(false);
        setAmount("");
        setMethod("tunai");
        setPaidAt("");
        setReason("");
        setFormError("");
    };

    const submitEntry = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormError("");
        if (!depositor || !Number(amount) || Number(amount) < 1) {
            setFormError("Pilih penyetor dan masukkan nominal yang valid.");
            return;
        }

        setIsSaving(true);
        try {
            await createCashEntry({
                data: {
                    depositorUserId: depositor,
                    amount: Number(amount),
                    method,
                    ...(paidAt ? { paidAt } : {}),
                    ...(reason.trim() ? { reason: reason.trim() } : {}),
                },
            });
            resetEntryForm();
            setIsAddOpen(false);
            setSuccess("Pembayaran kas berhasil dicatat.");
            try {
                await refresh(selectedId);
            } catch {
                setPageError("Pembayaran tercatat, tetapi ringkasan gagal diperbarui. Coba ganti periode lalu kembali.");
            }
            // Selalu invalidasi (di luar try refresh) agar dashboard/log ikut segar
            // walau refresh lokal gagal.
            await router.invalidate().catch(() => { });
        } catch (error) {
            setFormError(error instanceof Error ? error.message : "Gagal menyimpan kas.");
        } finally {
            setIsSaving(false);
        }
    };

    const submitNominal = async () => {
        setPageError("");
        try {
            await updateNominalKas({ data: { value: Number(nominal) } });
            await refresh(selectedId);
            setSuccess("Nominal iuran berhasil diperbarui.");
        } catch (error) {
            setPageError(error instanceof Error ? error.message : "Gagal menyimpan nominal.");
        }
        // Selalu invalidasi agar dashboard/log ikut segar walau refresh lokal gagal.
        await router.invalidate().catch(() => { });
    };

    const submitClosePeriode = async () => {
        setPageError("");
        if (!closeReason.trim()) {
            setPageError("Alasan penutupan minggu wajib diisi.");
            return;
        }
        if (
            !window.confirm(
                `Tutup Minggu ${stats.periode.nomor} dan buka minggu baru? Rekap akan diarsipkan dan tidak bisa diubah.`,
            )
        ) {
            return;
        }

        try {
            const next = await closeAndOpenPeriode({ data: { reason: closeReason } });
            setCloseReason("");
            const [nextPeriodes, active] = await Promise.all([
                listPeriodes(),
                getActivePeriode(),
            ]);
            const nextId = active?.id ?? next.id;
            setPeriodes(nextPeriodes);
            setSelectedId(nextId);
            await refresh(nextId);
            setSuccess("Periode baru berhasil dibuka.");
        } catch (error) {
            setPageError(error instanceof Error ? error.message : "Gagal menutup periode.");
        }
        // Selalu invalidasi agar dashboard/log ikut segar walau refresh lokal gagal.
        await router.invalidate().catch(() => { });
    };

    if (isPaymentRoute) return <Outlet />;

    return (
        <main
            id="main-content"
            className={`${pageShell} bg-background text-foreground [&_.text-ink]:text-foreground [&_.text-body]:text-foreground [&_.text-muted]:text-muted-foreground [&_.text-body-sm]:text-muted-foreground [&_.text-caption]:text-muted-foreground [&_.text-caption-sm]:text-muted-foreground [&_.bg-canvas]:bg-card [&_.bg-surface-soft]:bg-muted [&_.border-hairline-soft]:border-border [&_.border-hairline]:border-border`}
        >
            <nav aria-label="Navigasi utama" className="mb-8 flex min-h-16 flex-wrap items-center gap-3 border-b border-border py-3">
                <span className="mr-auto text-caption-sm text-muted-foreground">{session?.user.email} ({role})</span>
                <Link to="/" className={navClass}>Dashboard</Link>
                <Link to="/kas/bayar" className="rounded-full bg-[#ff6680] px-4 py-2 text-button-sm font-semibold text-[#24151a] transition-colors hover:bg-[#ff8197] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6680]/50">Bayar iuran</Link>
                <Link to="/log" className={navClass}>Log</Link>
            </nav>

            <header className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 text-caption font-medium uppercase tracking-[0.16em] text-[#ff8197]">Kas · Minggu {stats.periode.nomor}</p>
                    <h1 className="text-display-xl tracking-tight text-foreground">Rekap kas</h1>
                    <p className="mt-2 max-w-[65ch] text-body-md text-muted-foreground">Pantau iuran dan status pembayaran anggota.</p>
                </div>
                <span className="inline-flex w-fit items-center rounded-full border border-border bg-card px-3 py-1.5 text-caption-sm text-muted-foreground">
                    {isActive ? "Periode aktif" : "Periode arsip"}
                </span>
            </header>

            <ul aria-label="Daftar bendahara" className="mb-2 flex flex-wrap gap-2">
                {stats.bendaharaList.length === 0 ? (
                    <li className="rounded-full border border-border bg-card px-3 py-1.5 text-body-sm text-muted-foreground">Bendahara belum ditentukan</li>
                ) : (
                    stats.bendaharaList.map((bendahara) => (
                        <li key={bendahara.id} className="rounded-full border border-border bg-card px-3 py-1.5 text-body-sm text-foreground">
                            {bendahara.name}
                        </li>
                    ))
                )}
            </ul>

            {!isActive && (
                <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                    Periode arsip · hanya dapat dilihat, tidak bisa diubah.
                </div>
            )}

            <section aria-label="Ringkasan kas" className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Kas per Minggu" value={rupiah(stats.nominalKas)} caption="Iuran wajib tiap anggota per minggu" />
                <StatCard label="Ekspektasi Kas Terkumpul" value={rupiah(stats.ekspektasiPeriode)} caption={`${stats.userCount} anggota × ${rupiah(stats.nominalKas)}`} />
                <StatCard label="Kas Terkumpul" value={rupiah(stats.totalPeriode)} caption={`Total semua periode ${rupiah(stats.totalSemua)}`} />
            </section>

            {pageError && <div className="mt-6"><ErrorAlert>{pageError}</ErrorAlert></div>}

            <Section
                title="Status iuran anggota"
                description="Setiap minggu berdiri sendiri — setoran minggu lalu tidak terbawa."
                aside={
                    <PeriodeSelect
                        value={selectedId}
                        onChange={changePeriode}
                        options={periodes}
                    />
                }
            >
                <div className={tableShell}>
                    <table className={tableClass}>
                        <caption className="sr-only">Status iuran kas per anggota</caption>
                        <thead className={theadClass}>
                            <tr>
                                <th scope="col" className={thClass}>Nama</th>
                                <th scope="col" className={`${thClass} text-right`}>Target kas</th>
                                <th scope="col" className={`${thClass} text-right`}>Terkumpul</th>
                                <th scope="col" className={`${thClass} text-right`}>Kekurangan</th>
                                <th scope="col" className={thClass}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {status.length === 0 && <EmptyRow colSpan={5}>Belum ada anggota terdaftar.</EmptyRow>}
                            {status.map((member) => {
                                const target = stats.nominalKas;
                                const collected = Math.max(0, target - member.kurang);
                                const statusLabel = member.kurang === 0
                                    ? "Lunas"
                                    : collected === 0
                                        ? "Belum bayar"
                                        : "Belum lunas";

                                return (
                                    <tr key={member.id} className={trClass}>
                                        <td className={tdClass}>
                                            <span className="text-ink">{member.name}</span>
                                            <div className="text-caption-sm text-muted tabular-nums">NIM {member.id}</div>
                                            <div className="text-caption-sm text-muted">{member.email}</div>
                                            <div className="text-caption-sm text-muted tabular-nums">
                                                {member.mingguLunas}/{member.mingguTotal} minggu
                                                {member.lastMethod ? ` · ${member.lastMethod}` : ""}
                                            </div>
                                        </td>
                                        <td className={`${tdClass} text-right tabular-nums`}>{rupiah(target)}</td>
                                        <td className={`${tdClass} text-right tabular-nums`}>{rupiah(collected)}</td>
                                        <td className={`${tdClass} text-right tabular-nums`}>{rupiah(member.kurang)}</td>
                                        <td className={tdClass}>
                                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${member.kurang === 0 ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-amber-300/25 bg-amber-300/10 text-amber-200"}`}>
                                                {statusLabel}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Section>

            {isBendahara && isActive && (
                <details className="mt-12 rounded-2xl border border-border bg-card p-5 sm:p-6">
                    <summary className="cursor-pointer list-none text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6680]/50">
                        Pengaturan periode
                        <span className="ml-2 text-sm font-normal text-muted-foreground">Nominal iuran dan penutupan minggu</span>
                    </summary>
                    <div className="mt-6 grid gap-8 lg:grid-cols-2">
                        <div>
                            <h2 className="text-sm font-semibold">Nominal iuran · Minggu {stats.periode.nomor}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Berlaku untuk seluruh anggota pada periode aktif.</p>
                            <div className="mt-3 flex flex-wrap gap-3">
                                <input
                                    value={nominal}
                                    onChange={(event) => setNominal(event.target.value)}
                                    inputMode="numeric"
                                    aria-label="Nominal kas (iuran)"
                                    className={`${darkInputClass} w-full max-w-[16rem]`}
                                />
                                <Button type="button" variant="secondary" onClick={submitNominal}>Simpan nominal</Button>
                            </div>
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold">Tutup minggu dan buka periode baru</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Rekap minggu ini akan diarsipkan dan dikunci.</p>
                            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                                <input
                                    value={closeReason}
                                    onChange={(event) => setCloseReason(event.target.value)}
                                    placeholder="Alasan penutupan (wajib)"
                                    aria-label="Alasan penutupan (wajib)"
                                    className={`${darkInputClass} w-full sm:max-w-md`}
                                />
                                <Button type="button" variant="secondary" onClick={submitClosePeriode} className="sm:w-auto">
                                    Tutup minggu
                                </Button>
                            </div>
                        </div>
                    </div>
                </details>
            )}

            {isBendahara && isActive && (
                <button
                    type="button"
                    onClick={() => {
                        resetEntryForm();
                        setIsAddOpen(true);
                    }}
                    aria-label="Tambah pembayaran kas"
                    title="Tambah pembayaran kas"
                    className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#ff6680] text-3xl font-light leading-none text-[#24151a] shadow-[0_10px_30px_rgba(255,102,128,0.28)] transition-transform hover:scale-105 hover:bg-[#ff8197] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ff6680]/40 sm:bottom-8 sm:right-8 sm:h-16 sm:w-16"
                >
                    <span aria-hidden="true">+</span>
                </button>
            )}

            {isAddOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !isSaving) setIsAddOpen(false);
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-cash-title"
                        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-border bg-card p-5 text-foreground shadow-2xl sm:rounded-2xl sm:p-7"
                    >
                        <div className="mb-6 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#ff8197]">Minggu {stats.periode.nomor}</p>
                                <h2 id="add-cash-title" className="mt-1 text-xl font-semibold">Tambah pembayaran</h2>
                                <p className="mt-1 text-sm text-muted-foreground">Iuran per anggota {rupiah(stats.nominalKas)}</p>
                            </div>
                            <button
                                type="button"
                                aria-label="Tutup formulir"
                                disabled={isSaving}
                                onClick={() => setIsAddOpen(false)}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6680]/50"
                            >
                                ×
                            </button>
                        </div>

                        {formError && <ErrorAlert>{formError}</ErrorAlert>}

                        <form onSubmit={submitEntry} className="space-y-4">
                            <Field label="Penyetor">
                                <div className="relative">
                                    <input
                                        value={selectedDepositor ? `${selectedDepositor.name} · ${selectedDepositor.id}` : depositorQuery}
                                        onChange={(event) => {
                                            setDepositor("");
                                            setDepositorQuery(event.target.value);
                                            setDepositorOpen(true);
                                        }}
                                        onFocus={() => setDepositorOpen(true)}
                                        onBlur={() => window.setTimeout(() => setDepositorOpen(false), 120)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Escape") setDepositorOpen(false);
                                        }}
                                        placeholder="Ketik nama / NIM / email…"
                                        aria-label="Cari penyetor"
                                        aria-expanded={depositorOpen}
                                        aria-autocomplete="list"
                                        role="combobox"
                                        autoComplete="off"
                                        className={darkInputClass}
                                        required={!depositor}
                                    />
                                    {selectedDepositor && (
                                        <button
                                            type="button"
                                            onClick={() => pickDepositor("")}
                                            aria-label="Hapus penyetor terpilih"
                                            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full px-2 text-lg leading-none text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6680]/50"
                                        >
                                            ×
                                        </button>
                                    )}
                                    {depositorOpen && !selectedDepositor && (
                                        <ul
                                            role="listbox"
                                            aria-label="Hasil pencarian anggota"
                                            className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl"
                                        >
                                            {depositorMatches.length === 0 && (
                                                <li className="px-3 py-2.5 text-sm text-muted-foreground">Tidak ada anggota yang cocok.</li>
                                            )}
                                            {depositorMatches.map((user) => (
                                                <li key={user.id} role="option" aria-selected={false}>
                                                    <button
                                                        type="button"
                                                        onMouseDown={(event) => event.preventDefault()}
                                                        onClick={() => pickDepositor(user.id)}
                                                        className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6680]/50"
                                                    >
                                                        <span className="text-sm font-medium text-foreground">{user.name}</span>
                                                        <span className="text-xs text-muted-foreground tabular-nums">NIM {user.id} · {user.email}</span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </Field>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Nominal (Rp)">
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(event) => setAmount(event.target.value)}
                                        inputMode="numeric"
                                        placeholder="50000"
                                        min="1"
                                        step="1"
                                        className={darkInputClass}
                                        required
                                    />
                                </Field>
                                <Field label="Metode pembayaran">
                                    <select
                                        value={method}
                                        onChange={(event) => setMethod(event.target.value as CashMethod)}
                                        className={darkSelectClass}
                                    >
                                        <option value="tunai">Tunai</option>
                                        <option value="non-tunai">Non-tunai</option>
                                    </select>
                                </Field>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Tanggal pembayaran">
                                    <input
                                        type="date"
                                        value={paidAt}
                                        onChange={(event) => setPaidAt(event.target.value)}
                                        className={darkInputClass}
                                    />
                                </Field>
                                <Field label="Catatan (opsional)">
                                    <input
                                        value={reason}
                                        onChange={(event) => setReason(event.target.value)}
                                        placeholder="Contoh: transfer"
                                        className={darkInputClass}
                                    />
                                </Field>
                            </div>
                            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                                <Button type="button" variant="secondary" onClick={() => setIsAddOpen(false)} disabled={isSaving}>
                                    Batal
                                </Button>
                                <Button type="submit" disabled={isSaving} className="bg-[#ff6680] text-[#24151a] hover:bg-[#ff8197] focus-visible:ring-[#ff6680]/50">
                                    {isSaving ? "Menyimpan…" : "Simpan pembayaran"}
                                </Button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

            {success && (
                <div role="status" className="fixed bottom-5 left-4 z-[60] flex max-w-[calc(100vw-7rem)] items-center gap-3 rounded-xl border border-emerald-400/25 bg-card px-4 py-3 text-sm text-emerald-200 shadow-xl sm:bottom-8 sm:left-8">
                    <span>{success}</span>
                    <button type="button" onClick={() => setSuccess("")} aria-label="Tutup notifikasi" className="text-lg leading-none text-emerald-100">×</button>
                </div>
            )}
        </main>
    );
}
