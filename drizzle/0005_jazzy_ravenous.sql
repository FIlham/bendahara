CREATE TABLE "kas_periode" (
	"id" text PRIMARY KEY NOT NULL,
	"nomor" integer NOT NULL,
	"nominal" integer NOT NULL,
	"status" text NOT NULL,
	"opened_by" text NOT NULL,
	"opened_at" timestamp NOT NULL,
	"closed_by" text,
	"closed_at" timestamp,
	"snapshot" text,
	CONSTRAINT "kas_periode_nomor_unique" UNIQUE("nomor")
);
--> statement-breakpoint
ALTER TABLE "cash_entry" ADD COLUMN "periode_id" text;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD COLUMN "periode_id" text;--> statement-breakpoint
ALTER TABLE "kas_periode" ADD CONSTRAINT "kas_periode_opened_by_user_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kas_periode" ADD CONSTRAINT "kas_periode_closed_by_user_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_entry" ADD CONSTRAINT "cash_entry_periode_id_kas_periode_id_fk" FOREIGN KEY ("periode_id") REFERENCES "public"."kas_periode"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_periode_id_kas_periode_id_fk" FOREIGN KEY ("periode_id") REFERENCES "public"."kas_periode"("id") ON DELETE restrict ON UPDATE no action;