import { pgTable, text, timestamp, integer, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";

/**
 * Periode mingguan yang dikendalikan bendahara.
 * Semua agregat mingguan mengikuti periode aktif, bukan kalender.
 * Periode arsip dikunci total (read-only) dan menyimpan snapshot rekap.
 */
export const kasPeriode = pgTable("kas_periode", {
  id: text("id").primaryKey(),
  nomor: integer("nomor").notNull().unique(),
  nominal: integer("nominal").notNull(),
  status: text("status").notNull(),
  openedBy: text("opened_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  openedAt: timestamp("opened_at")
    .notNull()
    .$defaultFn(() => new Date()),
  closedBy: text("closed_by").references(() => user.id, {
    onDelete: "restrict",
  }),
  closedAt: timestamp("closed_at"),
  snapshot: text("snapshot"),
}, (table) => [
  check("kas_periode_nominal_check", sql`${table.nominal} >= 0`),
  check("kas_periode_status_check", sql`${table.status} IN ('aktif', 'arsip')`),
  // Hanya boleh ada satu periode aktif dalam satu waktu.
  uniqueIndex("kas_periode_single_active").on(table.status).where(sql`${table.status} = 'aktif'`),
]);

export type PeriodeStatus = "aktif" | "arsip";
export const PERIODE_AKTIF = "aktif";

export const cashEntry = pgTable(
  "cash_entry",
  {
    id: text("id").primaryKey(),
    depositorUserId: text("depositor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    method: text("method").notNull(),
    paidAt: timestamp("paid_at")
      .notNull()
      .$defaultFn(() => new Date()),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    periodeId: text("periode_id")
      .notNull()
      .references(() => kasPeriode.id, {
        onDelete: "restrict",
      }),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("cash_entry_depositor_idx").on(table.depositorUserId),
    index("cash_entry_paid_at_idx").on(table.paidAt),
    index("cash_entry_periode_idx").on(table.periodeId),
    check("cash_entry_amount_check", sql`${table.amount} > 0`),
    check(
      "cash_entry_method_check",
      sql`${table.method} IN ('tunai', 'non-tunai')`,
    ),
  ],
);

export const kasSetting = pgTable("kas_setting", {
  key: text("key").primaryKey(),
  value: integer("value").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export type CashMethod = "tunai" | "non-tunai";
export const CASH_METHODS: CashMethod[] = ["tunai", "non-tunai"];
export const NOMINAL_KAS_KEY = "nominal_kas";
/** Nominal default untuk seed DB fresh (periode 1 + kas_setting). */
export const DEFAULT_NOMINAL_KAS = 5000;

export const cashEntryLog = pgTable("cash_entry_log", {
  id: text("id").primaryKey(),
  cashEntryId: text("cash_entry_id")
    .notNull()
    .references(() => cashEntry.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  changedBy: text("changed_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  changes: text("changes").notNull(),
  reason: text("reason"),
  changedAt: timestamp("changed_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

export type CashLogAction = "create" | "update";

export const ledgerEntry = pgTable(
  "ledger_entry",
  {
    id: text("id").primaryKey(),
    tanggal: timestamp("tanggal")
      .notNull()
      .$defaultFn(() => new Date()),
    keterangan: text("keterangan").notNull(),
    tipe: text("tipe").notNull(),
    debit: integer("debit").notNull().default(0),
    kredit: integer("kredit").notNull().default(0),
    method: text("method").notNull(),
    sourceCashEntryId: text("source_cash_entry_id").references(
      () => cashEntry.id,
      { onDelete: "restrict" },
    ),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    periodeId: text("periode_id")
      .notNull()
      .references(() => kasPeriode.id, {
        onDelete: "restrict",
      }),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ledger_entry_tanggal_idx").on(table.tanggal),
    index("ledger_entry_periode_idx").on(table.periodeId),
    index("ledger_entry_source_cash_idx").on(table.sourceCashEntryId),
    check("ledger_entry_tipe_check", sql`${table.tipe} IN ('masuk', 'keluar')`),
    check(
      "ledger_entry_method_check",
      sql`${table.method} IN ('tunai', 'transfer')`,
    ),
    check(
      "ledger_entry_debit_kredit_check",
      sql`(${table.debit} = 0 AND ${table.kredit} > 0) OR (${table.kredit} = 0 AND ${table.debit} > 0)`,
    ),
  ],
);

export type LedgerTipe = "masuk" | "keluar";
export const LEDGER_TIPES: LedgerTipe[] = ["masuk", "keluar"];
export type LedgerMethod = "tunai" | "transfer";
export const LEDGER_METHODS: LedgerMethod[] = ["tunai", "transfer"];

/**
 * Unified audit trail for every bendahara mutation
 * (kas, nominal, ledger). Readable by all logged-in users.
 */
export const activityLog = pgTable("activity_log", {
  id: text("id").primaryKey(),
  actorId: text("actor_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  changes: text("changes").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("activity_log_entity_idx").on(table.entity),
  index("activity_log_created_at_idx").on(table.createdAt),
  check(
    "activity_log_entity_check",
    sql`${table.entity} IN ('kas', 'nominal', 'ledger', 'periode')`,
  ),
]);

export type ActivityEntity = "kas" | "nominal" | "ledger" | "periode";
