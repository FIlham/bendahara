import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { activityLog, type ActivityEntity } from "@/db/kas-schema";
import { assertEnum, assertLimit } from "@/lib/validate";
import type { LogChanges } from "@/lib/kas.functions";

async function requireSession() {
  const session = await auth.api.getSession({
    headers: getRequestHeaders(),
  });
  if (!session) throw new Error("Unauthorized");
  return session;
}

export interface ActivityFilter {
  entity?: ActivityEntity | "semua";
  limit?: number;
}

export const listActivityLogs = createServerFn({ method: "GET" })
  .validator((f: ActivityFilter) => f ?? {})
  .handler(async ({ data }) => {
    await requireSession();
    const entity =
      data.entity === undefined || data.entity === "semua"
        ? undefined
        : assertEnum(data.entity, ["kas", "nominal", "ledger", "periode"] as const, "Entitas");
    const { entity: _e, limit: _l, ...rest } = data;
    void _e; void _l;
    if (Object.keys(rest).length > 0) throw new Error("Filter tidak dikenal");
    const limit = assertLimit(data.limit, 100, 300);
    const rows = await db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        entity: activityLog.entity,
        entityId: activityLog.entityId,
        changes: activityLog.changes,
        reason: activityLog.reason,
        createdAt: activityLog.createdAt,
        actor: { name: user.name, email: user.email },
      })
      .from(activityLog)
      .innerJoin(user, eq(activityLog.actorId, user.id))
      .where(entity ? eq(activityLog.entity, entity) : undefined)
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      ...r,
      changes: JSON.parse(r.changes) as LogChanges,
    }));
  });
