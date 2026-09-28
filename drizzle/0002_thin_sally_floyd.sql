CREATE TABLE "cash_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"depositor_user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"method" text NOT NULL,
	"paid_at" timestamp NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kas_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer NOT NULL,
	"updated_by" text,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cash_entry" ADD CONSTRAINT "cash_entry_depositor_user_id_user_id_fk" FOREIGN KEY ("depositor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_entry" ADD CONSTRAINT "cash_entry_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_entry_depositor_idx" ON "cash_entry" USING btree ("depositor_user_id");--> statement-breakpoint
CREATE INDEX "cash_entry_paid_at_idx" ON "cash_entry" USING btree ("paid_at");