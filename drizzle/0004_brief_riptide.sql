CREATE TABLE "activity_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"changes" text NOT NULL,
	"reason" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"tanggal" timestamp NOT NULL,
	"keterangan" text NOT NULL,
	"tipe" text NOT NULL,
	"debit" integer DEFAULT 0 NOT NULL,
	"kredit" integer DEFAULT 0 NOT NULL,
	"method" text NOT NULL,
	"source_cash_entry_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_source_cash_entry_id_cash_entry_id_fk" FOREIGN KEY ("source_cash_entry_id") REFERENCES "public"."cash_entry"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_entry_tanggal_idx" ON "ledger_entry" USING btree ("tanggal");