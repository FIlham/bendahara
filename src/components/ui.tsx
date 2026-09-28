import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Shared UI primitives — PROMPT.md visual system.
 * White canvas, single rose accent used sparingly, flat cards,
 * calm Inter type. Presentation only; content stays in routes.
 */

/* ------------------------------------------------------------------ layout */

export const pageShell =
  "mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8 py-8 sm:py-12 pb-16 sm:pb-24";

export function PageHeader({
  title,
  subtitle,
  meta,
  badge,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:mb-10 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display-xl text-display-xl tracking-tight text-ink">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="mt-2 max-w-[65ch] text-body-md text-muted">{subtitle}</p>
        )}
      </div>
      {meta && <div className="flex flex-wrap items-center gap-3">{meta}</div>}
    </header>
  );
}

export function PageNav({
  email,
  role,
  links,
}: {
  email?: string;
  role?: string;
  links: ReactNode;
}) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="mb-8 flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline-soft bg-canvas py-3"
    >
      {email && (
        <span className="text-caption-sm text-muted">
          {email}
          {role ? ` (${role})` : ""}
        </span>
      )}
      <span aria-hidden="true" className="text-hairline">
        |
      </span>
      <div className="flex flex-wrap items-center gap-1">{links}</div>
    </nav>
  );
}

export function navLinkClass(active?: boolean) {
  return active
    ? "rounded-full bg-ink px-3 py-2 text-button-sm font-medium text-white"
    : "rounded-full px-3 py-2 text-button-sm font-medium text-ink transition-colors hover:bg-surface-soft hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-primary/30";
}

/* ------------------------------------------------------------------- cards */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border border-hairline-soft bg-canvas p-5 shadow-[0_2px_6px_rgba(0,0,0,0.04)] sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  caption,
  captionTone = "muted",
  icon,
  badge,
}: {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  captionTone?: "muted" | "primary" | "success";
  icon?: ReactNode;
  badge?: ReactNode;
}) {
  const captionCls =
    captionTone === "primary"
      ? "text-primary"
      : captionTone === "success"
        ? "text-body"
        : "text-muted";
  return (
    <div className="flex flex-col justify-between rounded-card border border-hairline-soft bg-canvas p-5 shadow-[0_2px_6px_rgba(0,0,0,0.04)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="text-caption text-muted">{label}</div>
        {badge ?? (icon && (
          <span
            aria-hidden="true"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-soft text-muted"
          >
            {icon}
          </span>
        ))}
      </div>
      <div className="mt-3">
        <div className="text-display-lg font-semibold tracking-tight text-ink tabular-nums">
          {value}
        </div>
        {caption && (
          <div className={`mt-1 text-caption-sm ${captionCls}`}>{caption}</div>
        )}
      </div>
    </div>
  );
}

/** Card with a label + plain body (bendahara list, expected-value block…). */
export function InfoCard({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-card border border-hairline-soft bg-canvas p-5 shadow-[0_2px_6px_rgba(0,0,0,0.04)] sm:p-6">
      <div className="text-caption text-muted">{label}</div>
      <div className="mt-2 text-body-sm text-ink">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ badges */

export type BadgeTone = "success" | "warn" | "danger" | "neutral" | "primary";

const badgeTones: Record<BadgeTone, string> = {
  success: "border border-[#cfe6d6] bg-[#eef7f0] text-[#1e7a46]",
  warn: "border border-[#f0d5cb] bg-[#fdf0ec] text-[#c13515]",
  danger: "border border-[#f0d5cb] bg-[#fdf0ec] text-[#c13515]",
  neutral: "border border-hairline-soft bg-surface-soft text-body",
  primary: "bg-primary text-on-primary",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-badge tracking-wide ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function ArchiveBadge() {
  return (
    <Badge tone="neutral">
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-muted-soft" />
      arsip
    </Badge>
  );
}

export function ActiveBadge() {
  return (
    <Badge tone="success">
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-tertiary" />
      aktif
    </Badge>
  );
}

/* ------------------------------------------------------------------ buttons */

export const btnPrimary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-button-md font-medium text-on-primary transition-colors hover:bg-primary-active active:bg-primary-active disabled:bg-primary-disabled disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none";

export const btnSecondary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-hairline bg-canvas px-5 py-3 text-button-md font-medium text-ink transition-colors hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none";

export const btnQuiet =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-surface-soft px-4 py-2.5 text-button-sm font-medium text-ink transition-colors hover:bg-surface-strong focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none";

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
}) {
  const base =
    variant === "primary"
      ? btnPrimary
      : variant === "secondary"
        ? btnSecondary
        : btnQuiet;
  return (
    <button
      type={type}
      className={`${base} ${className}`}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------- forms */

export const inputClass =
  "block w-full min-h-11 rounded-lg border border-hairline bg-canvas px-3 py-2.5 text-body-sm text-ink placeholder:text-muted-soft transition-colors hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-surface-soft disabled:text-muted";

export const selectClass = `${inputClass} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%236a6a6a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>')] bg-[length:16px_16px] bg-[right_0.75rem_center] bg-no-repeat pr-9`;

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className = "",
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={`block ${className}`}>
      <span className="mb-1.5 block text-caption text-body">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-caption-sm text-muted">{hint}</span>}
    </label>
  );
}

export function FieldsetRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}
    >
      {children}
    </div>
  );
}

export function FormPanel({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={typeof title === "string" ? title : undefined}
      className="mt-12 rounded-card border border-hairline-soft bg-canvas p-5 shadow-[0_2px_6px_rgba(0,0,0,0.04)] sm:mt-16 sm:p-6"
    >
      <h2 className="text-display-md tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------- containers */

export function Section({
  title,
  description,
  aside,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-12 sm:mt-16">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-display-md tracking-tight text-ink">{title}</h2>
          {description && (
            <p className="mt-1 max-w-[65ch] text-body-sm text-muted">{description}</p>
          )}
        </div>
        {aside && <div className="flex-shrink-0">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warn";
}) {
  const cls =
    tone === "warn"
      ? "border-hairline bg-surface-soft text-body"
      : "border-hairline-soft bg-surface-soft text-body";
  return (
    <p
      className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-body-sm ${cls}`}
    >
      {children}
    </p>
  );
}

export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="mb-4 rounded-lg border border-error-container bg-error-container/60 px-4 py-3 text-body-sm font-medium text-on-error-container"
    >
      {children}
    </p>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-strong"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progres terkumpul"
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ tables */

export const tableShell =
  "w-full overflow-x-auto rounded-card border border-hairline-soft bg-canvas shadow-[0_2px_6px_rgba(0,0,0,0.04)]";

export const tableClass =
  "w-full min-w-[720px] border-collapse text-left text-body-sm";

export const theadClass = "bg-surface-soft text-micro-label text-muted";

export const thClass = "px-4 py-3 font-semibold whitespace-nowrap sm:px-5";

export const trClass = "border-t border-hairline-soft transition-colors hover:bg-surface-soft/70";

export const tdClass = "px-4 py-3 align-top text-body sm:px-5";

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-5 py-8 text-center text-body-sm text-muted"
      >
        {children}
      </td>
    </tr>
  );
}

/* --------------------------------------------------------------- periode UI */

export function PeriodeSelect({
  value,
  onChange,
  options,
  label = "Periode",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; nomor: number; status: string }[];
  label?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="text-caption text-body">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${selectClass} w-auto min-h-11 min-w-[12rem] rounded-full bg-surface-soft pr-10`}
      >
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            Minggu {p.nomor}
            {p.status !== "aktif" ? " (arsip)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
