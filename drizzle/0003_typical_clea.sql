CREATE TABLE "cash_entry_log" (
	"id" text PRIMARY KEY NOT NULL,
	"cash_entry_id" text NOT NULL,
	"action" text NOT NULL,
	"changed_by" text NOT NULL,
	"changes" text NOT NULL,
	"reason" text,
	"changed_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cash_entry_log" ADD CONSTRAINT "cash_entry_log_cash_entry_id_cash_entry_id_fk" FOREIGN KEY ("cash_entry_id") REFERENCES "public"."cash_entry"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_entry_log" ADD CONSTRAINT "cash_entry_log_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;