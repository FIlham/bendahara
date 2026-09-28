import { useState } from "react";
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { ensureSession } from "@/lib/auth.functions";
import {
  listActivityLogs,
  type ActivityFilter,
} from "@/lib/activity.functions";
import {
  Button,
  EmptyRow,
  ErrorAlert,
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

const darkSelectClass = `${selectClass} dark:border-border dark:bg-input dark:text-foreground dark:focus:border-[#ff6680] dark:focus:ring-[#ff6680]/30`;

export const Route = createFileRoute("/log")({
  beforeLoad: async () => {
    try {
      await ensureSession();
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  loader: async () => listActivityLogs({ data: {} }),
  component: Log,
});

function formatValue(field: string, v: string | number | null): string {
  if (v === null || v === undefined) return "-";
  if (field === "nominal" && typeof v === "number") {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(v);
  }
  if (field === "tanggal") {
    return new Date(v).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return String(v);
}

const entityLabel: Record<string, string> = {
  kas: "Kas",
  nominal: "Nominal",
  ledger: "Keuangan",
  periode: "Periode",
};

const entityPills: { value: ActivityFilter["entity"]; label: string }[] = [
  { value: "semua", label: "Semua" },
  { value: "kas", label: "Kas" },
  { value: "nominal", label: "Nominal" },
  { value: "ledger", label: "Keuangan" },
  { value: "periode", label: "Periode" },
];

const limitOptions = [50, 100, 200];
const LOG_PAGE_SIZE = 15;

const fmtTime = (d: string | Date) =>
  new Date(d).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function Log() {
  const loaded = Route.useLoaderData();
  const { data: session } = authClient.useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "user";
  const [logs, setLogs] = useState(loaded);
  const [entity, setEntity] = useState<ActivityFilter["entity"]>("semua");
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");

  const fetchLogs = async (
    nextEntity: ActivityFilter["entity"],
    nextLimit: number,
  ) => {
    setLoading(true);
    setError("");
    try {
      setLogs(await listActivityLogs({ data: { entity: nextEntity, limit: nextLimit } }));
      setPage(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat log");
    } finally {
      setLoading(false);
    }
  };

  const pickEntity = (value: ActivityFilter["entity"]) => {
    setEntity(value);
    void fetchLogs(value, limit);
  };

  const pickLimit = (value: number) => {
    setLimit(value);
    void fetchLogs(entity, value);
  };

  const pageCount = Math.max(1, Math.ceil(logs.length / LOG_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = logs.slice(safePage * LOG_PAGE_SIZE, safePage * LOG_PAGE_SIZE + LOG_PAGE_SIZE);

  return (
    <main id="main-content" className={`${pageShell} min-h-screen bg-background text-foreground`}>
      <nav aria-label="Navigasi utama" className="mb-8 flex min-h-16 flex-wrap items-center gap-3 border-b border-border py-3">
        <span className="mr-auto text-caption-sm text-muted-foreground">{session?.user.email} ({role})</span>
        <Link to="/" className={navClass}>Dashboard</Link>
        <Link to="/kas" className={navClass}>Kas</Link>
      </nav>

      <header className="mb-8 sm:mb-10">
        <p className="mb-2 text-caption font-medium uppercase tracking-[0.16em] text-[#ff8197]">Audit aktivitas</p>
        <h1 className="text-display-xl tracking-tight">Log perubahan</h1>
        <p className="mt-2 max-w-[65ch] text-body-md text-muted-foreground">Riwayat perubahan kas, nominal, dan laporan keuangan beserta alasan pencatatannya.</p>

        <div className="mt-6 flex flex-col gap-4 rounded-card border border-border bg-muted/60 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Filter entitas" className="flex flex-wrap gap-1.5">
            {entityPills.map((pill) => {
              const active = entity === pill.value;
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => pickEntity(pill.value)}
                  aria-pressed={active}
                  className={`min-h-9 rounded-full px-4 py-1.5 text-button-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6680]/50 ${
                    active
                      ? "bg-[#ff6680] text-[#24151a]"
                      : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
          <label className="inline-flex items-center gap-2">
            <span className="text-caption-sm text-muted-foreground">Tampilkan</span>
            <select
              aria-label="Jumlah log ditampilkan"
              value={limit}
              onChange={(e) => pickLimit(Number(e.target.value))}
              className={`${darkSelectClass} w-auto min-w-[7rem]`}
            >
              {limitOptions.map((n) => (
                <option key={n} value={n}>{n} terbaru</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-1 py-3 sm:px-2">
        <h2 className="text-sm font-semibold">Aktivitas terbaru</h2>
        <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {loading ? "Memuat…" : `${logs.length} catatan`}
        </span>
      </div>

      <div className={`${tableShell} hidden border-border bg-card shadow-none dark:border-border dark:bg-card dark:shadow-none md:block`}>
        <table className={tableClass}>
          <caption className="sr-only">Log seluruh perubahan</caption>
          <thead className={`${theadClass} dark:bg-muted dark:text-muted-foreground`}>
            <tr>
              <th scope="col" className={thClass}>Waktu</th>
              <th scope="col" className={thClass}>Oleh</th>
              <th scope="col" className={thClass}>Entitas</th>
              <th scope="col" className={thClass}>Aksi</th>
              <th scope="col" className={thClass}>Perubahan</th>
              <th scope="col" className={thClass}>Alasan</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && <EmptyRow colSpan={6}>{loading ? "Memuat…" : "Belum ada log."}</EmptyRow>}
            {paged.map((l) => (
              <tr key={l.id} className={`${trClass} dark:border-border dark:hover:bg-muted/70`}>
                <td className={`${tdClass} whitespace-nowrap tabular-nums dark:text-foreground`} title={fmtTime(l.createdAt)}>
                  {fmtTime(l.createdAt)}
                </td>
                <td className={`${tdClass} dark:text-foreground`}>
                  <span className="text-ink dark:text-foreground">{l.actor.name}</span>
                  <div className="text-caption-sm text-muted dark:text-muted-foreground">
                    {l.actor.email}
                  </div>
                </td>
                <td className={`${tdClass} dark:text-foreground`}>
                  <span className="inline-flex whitespace-nowrap rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {entityLabel[l.entity] ?? l.entity}
                  </span>
                </td>
                <td className={`${tdClass} dark:text-foreground`}>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${l.action === "create" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-amber-300/25 bg-amber-300/10 text-amber-200"}`}>
                    {l.action === "create" ? "catat" : "ubah"}
                  </span>
                </td>
                <td className={`${tdClass} dark:text-foreground`}>
                  <dl className="m-0 space-y-1.5">
                    {Object.entries(l.changes).map(([field, v]) => (
                      <div key={field} className="text-[13px] leading-5">
                        <dt className="inline font-medium text-muted-foreground">{field}: </dt>
                        <dd className="inline tabular-nums">
                          {formatValue(field, v.old)} <span aria-hidden="true" className="text-muted-foreground">→</span>{" "}
                          {formatValue(field, v.new)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </td>
                <td className={`${tdClass} max-w-56 break-words dark:text-foreground`}>{l.reason || <span className="text-muted-foreground">-</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {paged.length === 0 && (
          <div className="rounded-card border border-dashed border-border bg-card px-4 py-8 text-center text-body-sm text-muted-foreground">
            {loading ? "Memuat…" : "Belum ada log."}
          </div>
        )}
        {paged.map((l) => (
          <article key={l.id} className="rounded-card border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {entityLabel[l.entity] ?? l.entity}
              </span>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${l.action === "create" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-amber-300/25 bg-amber-300/10 text-amber-200"}`}>
                {l.action === "create" ? "catat" : "ubah"}
              </span>
              <time className="ml-auto text-caption-sm tabular-nums text-muted-foreground">{fmtTime(l.createdAt)}</time>
            </div>
            <p className="mt-3 text-body-sm font-medium text-foreground">
              {l.actor.name} <span className="font-normal text-muted-foreground">· {l.actor.email}</span>
            </p>
            <dl className="mt-2 space-y-1 border-t border-border pt-2">
              {Object.entries(l.changes).map(([field, v]) => (
                <div key={field} className="text-[13px] leading-5">
                  <dt className="inline font-medium text-muted-foreground">{field}: </dt>
                  <dd className="inline tabular-nums text-foreground">
                    {formatValue(field, v.old)} → {formatValue(field, v.new)}
                  </dd>
                </div>
              ))}
            </dl>
            {l.reason && <p className="mt-2 text-caption-sm text-muted-foreground">Alasan: {l.reason}</p>}
          </article>
        ))}
      </div>

      {pageCount > 1 && (
        <nav aria-label="Navigasi halaman log" className="mt-4 flex items-center justify-between gap-3">
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
    </main>
  );
}
