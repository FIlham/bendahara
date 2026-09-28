CREATE INDEX "activity_log_entity_idx" ON "activity_log" USING btree ("entity");--> statement-breakpoint
CREATE INDEX "activity_log_created_at_idx" ON "activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cash_entry_periode_idx" ON "cash_entry" USING btree ("periode_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kas_periode_single_active" ON "kas_periode" USING btree ("status") WHERE "kas_periode"."status" = 'aktif';--> statement-breakpoint
CREATE INDEX "ledger_entry_periode_idx" ON "ledger_entry" USING btree ("periode_id");--> statement-breakpoint
CREATE INDEX "ledger_entry_source_cash_idx" ON "ledger_entry" USING btree ("source_cash_entry_id");--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_entity_check" CHECK ("activity_log"."entity" IN ('kas', 'nominal', 'ledger', 'periode'));--> statement-breakpoint
ALTER TABLE "cash_entry" ADD CONSTRAINT "cash_entry_amount_check" CHECK ("cash_entry"."amount" > 0);--> statement-breakpoint
ALTER TABLE "cash_entry" ADD CONSTRAINT "cash_entry_method_check" CHECK ("cash_entry"."method" IN ('tunai', 'non-tunai'));--> statement-breakpoint
ALTER TABLE "kas_periode" ADD CONSTRAINT "kas_periode_nominal_check" CHECK ("kas_periode"."nominal" >= 0);--> statement-breakpoint
ALTER TABLE "kas_periode" ADD CONSTRAINT "kas_periode_status_check" CHECK ("kas_periode"."status" IN ('aktif', 'arsip'));--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_tipe_check" CHECK ("ledger_entry"."tipe" IN ('masuk', 'keluar'));--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_method_check" CHECK ("ledger_entry"."method" IN ('tunai', 'transfer'));--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_debit_kredit_check" CHECK (("ledger_entry"."debit" = 0 AND "ledger_entry"."kredit" > 0) OR ("ledger_entry"."kredit" = 0 AND "ledger_entry"."debit" > 0));