import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth, type AppRole } from "@/lib/auth";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const session = await auth.api.getSession({
    headers: getRequestHeaders(),
  });

  return session;
});

export const ensureSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await auth.api.getSession({
      headers: getRequestHeaders(),
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    return session;
  },
);

export const ensureRole = createServerFn({ method: "GET" })
  .validator((role: AppRole) => role)
  .handler(async ({ data: role }) => {
    const session = await auth.api.getSession({
      headers: getRequestHeaders(),
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const userRole = (session.user as { role?: string }).role ?? "user";
    if (userRole !== role) {
      throw new Error("Forbidden");
    }

    return session;
  });

export const ensureBendahara = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await auth.api.getSession({
      headers: getRequestHeaders(),
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const userRole = (session.user as { role?: string }).role ?? "user";
    if (userRole !== "bendahara") {
      throw new Error("Forbidden");
    }

    return session;
  },
);
