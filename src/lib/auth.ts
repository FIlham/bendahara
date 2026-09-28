import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { eq } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/auth-schema";
import { getEnv, assertServerEnv } from "./env";

// Gagal cepat dengan pesan jelas bila secret/URL belum diset di Vercel.
assertServerEnv();

export type AppRole = "user" | "bendahara";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),
    // Closed registration: Google-only, admin provisions users first.
    emailAndPassword: {
        enabled: false,
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: false,
                defaultValue: "user",
                input: false,
            },
        },
        // Allowlist Plan A: only pre-registered emails may sign in / link.
        // Runs on create-user, link-account, and every OAuth sign-in.
        validateUserInfo: async ({ user, source }) => {
            if (source.oauth?.providerId !== "google") {
                return;
            }
            const email = user.email?.toLowerCase();
            if (!email) {
                return {
                    error: "user_not_registered",
                    errorDescription: "This Google account is not registered.",
                };
            }
            const existing = await db.query.user.findFirst({
                where: eq(schema.user.email, email),
            });
            if (!existing) {
                return {
                    error: "user_not_registered",
                    errorDescription: "This Google account is not registered.",
                };
            }
        },
    },
    socialProviders: {
        google: {
            clientId: getEnv("GOOGLE_CLIENT_ID"),
            clientSecret: getEnv("GOOGLE_CLIENT_SECRET"),
            // No implicit signup: unknown Google identities are rejected.
            disableSignUp: true,
        },
    },
    session: {
        cookieCache: {
            enabled: true,
        }
    },
    // tanstackStartCookies must be the last plugin in the array
    plugins: [tanstackStartCookies()],
});
