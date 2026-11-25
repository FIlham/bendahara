import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import { Markdown } from "@tanstack/markdown/react";
import { authClient } from "@/lib/auth/client";
import { ensureSession } from "@/lib/auth/functions";
import { getAiStatus } from "@/lib/server/ai";
import { allToolDefs } from "@/lib/ai/tools";
import { pageShell } from "@/components/ui";

const navClass =
    "rounded-full px-3 py-2 text-button-sm font-medium text-foreground transition-colors hover:bg-muted hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6680]/50";

const primaryBtn =
    "inline-flex min-h-11 items-center justify-center rounded-lg bg-[#ff6680] px-5 py-2.5 text-sm font-semibold text-[#24151a] transition-colors hover:bg-[#ff8197] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6680]/50";
const secondaryBtn =
    "inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6680]/50";
const inputDark =
    "block w-full resize-y rounded-lg border border-border bg-input px-3 py-2.5 text-body-sm text-foreground placeholder:text-muted-foreground focus:border-[#ff6680] focus:outline-none focus:ring-2 focus:ring-[#ff6680]/30";

const TOOL_LABEL: Record<string, string> = {
    ringkasan_keuangan: "Membaca ringkasan keuangan",
    daftar_periode: "Membaca daftar periode",
    riwayat_kas: "Membaca riwayat kas",
    status_iuran: "Membaca status iuran",
    buku_keuangan: "Membaca buku keuangan",
    catat_setoran_kas: "Catat setoran kas",
    catat_entri_keuangan: "Catat entri keuangan",
};

const FIELD_LABEL: Record<string, string> = {
    depositorUserId: "Penyetor (NIM)",
    amount: "Nominal",
    method: "Metode",
    paidAt: "Tanggal bayar",
    tanggal: "Tanggal",
    keterangan: "Keterangan",
    tipe: "Tipe",
    reason: "Alasan",
};

const rupiah = (n: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(n);

function fieldValue(key: string, value: unknown) {
    if (value === undefined || value === null || value === "") return "—";
    if (key === "amount") return rupiah(Number(value));
    return String(value);
}

export const Route = createFileRoute("/chat")({
    beforeLoad: async () => {
        try {
            await ensureSession();
        } catch {
            throw redirect({ to: "/login" });
        }
    },
    loader: async () => ({ aiEnabled: await getAiStatus() }),
    component: ChatPage,
});

function ChatPage() {
    const { aiEnabled } = Route.useLoaderData();
    const router = useRouter();
    const { data: session } = authClient.useSession();
    const role = (session?.user as { role?: string } | undefined)?.role ?? "user";
    const isBendahara = role === "bendahara";

    const [threadId] = useState(() => crypto.randomUUID());
    const [input, setInput] = useState("");
    const { messages, sendMessage, isLoading, error, interrupts, resuming } =
        useChat({
            connection: fetchServerSentEvents("/api/chat"),
            threadId,
            tools: allToolDefs,
            // Jangan mengantre pesan saat AI masih menjawab: tiap pesan
            // tambahan memakan kuota free tier.
            queue: "drop",
        });

    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: "end" });
    }, [messages, interrupts]);

    // Setelah run selesai (termasuk approval), segarkan data halaman lain.
    useEffect(() => {
        if (!isLoading && !resuming && messages.length > 0) {
            void router.invalidate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, resuming]);

    const send = (text: string) => {
        const value = text.trim();
        if (!value || isLoading) return;
        setInput("");
        void sendMessage(value);
    };

    const suggestions = isBendahara
        ? [
              "Berapa saldo keseluruhan?",
              "Siapa yang belum lunas?",
              "Catat setoran 2210511001 tunai",
          ]
        : ["Berapa saldo keseluruhan?", "Siapa yang belum lunas?", "Berapa kas per minggu?"];

    return (
        <main id="main-content" className={`${pageShell} bg-background text-foreground`}>
            <nav
                aria-label="Navigasi utama"
                className="mb-8 flex min-h-16 flex-wrap items-center gap-3 border-b border-border py-3"
            >
                <span className="mr-auto text-caption-sm text-muted-foreground">
                    {session?.user.email} ({role})
                </span>
                <Link to="/" className={navClass}>
                    Dashboard
                </Link>
                <Link to="/kas" className={navClass}>
                    Kas
                </Link>
                <Link to="/log" className={navClass}>
                    Log
                </Link>
                {isBendahara && (
                    <Link to="/bendahara" className={navClass}>
                        Bendahara
                    </Link>
                )}
            </nav>

            <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 text-caption font-medium uppercase tracking-[0.16em] text-[#ff8197]">
                        Asisten AI
                    </p>
                    <h1 className="text-display-xl tracking-tight text-foreground">
                        Tanya keuangan
                    </h1>
                    <p className="mt-2 max-w-[65ch] text-body-md text-muted-foreground">
                        {isBendahara
                            ? "Mode asisten: AI boleh mencatat data keuangan setelah kamu setujui."
                            : "Mode hanya baca: AI menjawab dari data, tanpa mengubah apa pun."}
                    </p>
                </div>
                <span className="inline-flex w-fit items-center rounded-full border border-border bg-card px-3 py-1.5 text-caption-sm text-muted-foreground">
                    {isBendahara ? "Asisten" : "Hanya baca"}
                </span>
            </header>

            {!aiEnabled ? (
                <p className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                    Chatbot belum aktif. Set <code>GEMINI_API_KEY</code> di
                    environment (dan pastikan <code>AI_DISABLED</code> tidak
                    bernilai 1), lalu muat ulang halaman ini.
                </p>
            ) : (
                <>
                    <div className="rounded-xl border border-border bg-card">
                        <div className="flex max-h-[60vh] min-h-[320px] flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-6">
                            {messages.length === 0 && (
                                <div className="m-auto max-w-lg text-center">
                                    <p className="text-body-md text-muted-foreground">
                                        Tanya apa saja soal kas dan buku keuangan kelas.
                                    </p>
                                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                                        {suggestions.map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => send(s)}
                                                className="rounded-full border border-border bg-background px-3 py-1.5 text-body-sm text-foreground transition-colors hover:bg-muted"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={
                                        message.role === "user"
                                            ? "ml-auto max-w-[85%] rounded-xl bg-[#ff6680]/15 px-4 py-3"
                                            : "mr-auto max-w-[95%]"
                                    }
                                >
                                    {message.parts.map((part, index) => {
                                        if (part.type === "text") {
                                            return (
                                                <div
                                                    key={index}
                                                    className="space-y-3 text-body-sm text-foreground [&_a]:text-[#ff8197] [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:whitespace-pre-wrap [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-background [&_pre]:p-3 [&_ul]:list-disc [&_code]:rounded [&_code]:bg-background [&_code]:px-1"
                                                >
                                                    <Markdown>{part.content}</Markdown>
                                                </div>
                                            );
                                        }
                                        if (part.type === "tool-call") {
                                            return (
                                                <p
                                                    key={index}
                                                    className="text-caption-sm text-muted-foreground"
                                                >
                                                    {TOOL_LABEL[part.name] ?? part.name}…
                                                </p>
                                            );
                                        }
                                        if (
                                            part.type === "tool-result" &&
                                            part.state === "error"
                                        ) {
                                            return (
                                                <p
                                                    key={index}
                                                    className="text-caption-sm text-red-300"
                                                >
                                                    Gagal: {part.error}
                                                </p>
                                            );
                                        }
                                        return null;
                                    })}
                                </div>
                            ))}

                            {isLoading && (
                                <p className="text-caption-sm text-muted-foreground">
                                    Menyusun jawaban…
                                </p>
                            )}
                            <div ref={endRef} />
                        </div>
                    </div>

                    {interrupts.map((interrupt) => {
                        if (interrupt.kind !== "tool-approval") return null;
                        const args = interrupt.originalArgs as Record<string, unknown>;
                        return (
                            <div
                                key={interrupt.id}
                                className="mt-4 rounded-xl border border-[#ff6680]/40 bg-[#ff6680]/10 px-4 py-4"
                            >
                                <p className="text-caption font-medium uppercase tracking-[0.16em] text-[#ff8197]">
                                    Butuh persetujuan
                                </p>
                                <p className="mt-1 text-body-md font-semibold text-foreground">
                                    {TOOL_LABEL[interrupt.toolName] ?? interrupt.toolName}
                                </p>
                                <dl className="mt-3 grid gap-1 text-body-sm">
                                    {Object.entries(args).map(([key, value]) => (
                                        <div key={key} className="flex justify-between gap-4">
                                            <dt className="text-muted-foreground">
                                                {FIELD_LABEL[key] ?? key}
                                            </dt>
                                            <dd className="text-right text-foreground">
                                                {fieldValue(key, value)}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        className={primaryBtn}
                                        disabled={!interrupt.canResolve || resuming}
                                        onClick={() => interrupt.resolveInterrupt(true)}
                                    >
                                        Setujui
                                    </button>
                                    <button
                                        type="button"
                                        className={secondaryBtn}
                                        disabled={!interrupt.canResolve || resuming}
                                        onClick={() => interrupt.resolveInterrupt(false)}
                                    >
                                        Tolak
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {error && (
                        <p
                            role="alert"
                            className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100"
                        >
                            {error.message.includes("429")
                                ? "Batas pemakaian AI tercapai. Coba lagi beberapa menit lagi (kuota dibatasi agar tetap gratis)."
                                : "Gagal menghubungi AI. Coba lagi."}
                        </p>
                    )}

                    <form
                        className="mt-4 flex flex-col gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            send(input);
                        }}
                    >
                        <label className="sr-only" htmlFor="chat-input">
                            Pertanyaan
                        </label>
                        <textarea
                            id="chat-input"
                            rows={2}
                            value={input}
                            placeholder="Tanya saldo, status iuran, atau minta catat setoran…"
                            className={inputDark}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    send(input);
                                }
                            }}
                        />
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-caption-sm text-muted-foreground">
                                Enter untuk kirim, Shift+Enter baris baru.
                            </p>
                            <button
                                type="submit"
                                className={primaryBtn}
                                disabled={isLoading || !input.trim()}
                            >
                                {isLoading ? "Mengirim…" : "Kirim"}
                            </button>
                        </div>
                    </form>
                </>
            )}
        </main>
    );
}
