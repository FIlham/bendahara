import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as authSchema from "./auth-schema";
import * as kasSchema from "./kas-schema";
import { getEnv } from "@/lib/env";

const pool = new Pool({
    connectionString: getEnv("DATABASE_URL"),
    // Batas eksplisit agar tiap instance serverless tidak membanjiri
    // database dengan koneksi. Pakai pooler (PgBouncer/Neon/Supabase)
    // dari penyedia dan dekatkan region fungsi ke database.
    max: Number(process.env.PGPOOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});

export const db = drizzle(pool, {
    schema: { ...authSchema, ...kasSchema },
});
export type Database = typeof db;
