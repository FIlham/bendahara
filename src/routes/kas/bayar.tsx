import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { ensureSession } from "@/lib/auth.functions";
import { getCashStats, getQRIS } from "@/lib/kas.functions";
import { pageShell } from "@/components/ui";
import { getEnv } from "@/lib/env";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/kas/bayar")({
    beforeLoad: async () => {
        try {
            await ensureSession();
        } catch {
            throw redirect({ to: "/login" });
        }
    },
    loader: () => getCashStats({ data: {} }),
    component: BayarKas,
});

const rupiah = (n: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(n);

// QR sample generated with a demo-only payload, never a payment destination.
// const demoQrUrl =
//   "https://api.qrserver.com/v1/create-qr-code/?size=440x440&margin=12&data=DEMO%3ABUKAN-QR-PEMBAYARAN-AKTIF-2026B-MI-UNAIR-7F3A91C4";

function BayarKas() {
    const stats = Route.useLoaderData();
    const [qris, setQris] = useState("")
    const { data: session } = authClient.useSession();
    const role = (session?.user as { role?: string } | undefined)?.role ?? "user";

    useEffect(() => {
        const fn = async () => {
            const qrisImg = await getQRIS()
            setQris(qrisImg)
        }

        fn()
    }, [])

    return (
        <main id="main-content" className={`${pageShell} min-h-screen bg-background text-foreground`}>
            <nav aria-label="Navigasi utama" className="mb-10 flex min-h-16 flex-wrap items-center gap-3 border-b border-border py-3">
                <span className="mr-auto text-caption-sm text-muted-foreground">{session?.user.email} ({role})</span>
                <Link to="/" className="rounded-full px-3 py-2 text-button-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6680]/50">Dashboard</Link>
                <Link to="/kas" className="rounded-full px-3 py-2 text-button-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6680]/50">Rekap kas</Link>
            </nav>

            <section aria-labelledby="payment-title" className="rounded-2xl border border-border bg-card p-5 sm:p-8">
                <div className="grid items-center gap-7 md:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] md:gap-10">
                    <div>
                        <p className="text-caption font-medium uppercase tracking-[0.16em] text-[#ff8197]">Minggu {stats.periode.nomor}</p>
                        <h1 id="payment-title" className="mt-2 text-display-xl tracking-tight">Bayar kas</h1>
                        <p className="mt-2 text-sm text-muted-foreground">Iuran per anggota</p>
                        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{rupiah(stats.nominalKas)}<span className="ml-2 text-base font-normal text-muted-foreground">/ minggu</span></p>
                        <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">Gunakan informasi ini untuk melihat nominal iuran minggu berjalan. Setelah membayar, konfirmasikan kepada bendahara agar pembayaran dicatat.</p>
                        {/* <div className="mt-5 inline-flex rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-xs font-medium text-amber-200">QR demo · bukan kode pembayaran aktif</div> */}
                        <div>
                            <Link to="/kas" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#ff6680] px-5 py-2.5 text-sm font-semibold text-[#24151a] transition-colors hover:bg-[#ff8197] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6680]/50">Kembali ke rekap kas</Link>
                        </div>
                    </div>
                    <div className="mx-auto w-full max-w-[320px] rounded-xl bg-white p-1">
                        <img src={qris} alt="QR demo, bukan kode pembayaran aktif" width="440" height="440" className="h-auto w-full rounded-md" />
                    </div>
                </div>
            </section>
        </main>
    );
}
