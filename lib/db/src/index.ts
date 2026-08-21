import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

function normalizeConnectionString(value: string) {
  const trimmed = value.trim();
  const hasMatchingOuterQuotes =
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'));

  return hasMatchingOuterQuotes ? trimmed.slice(1, -1).trim() : trimmed;
}

// This application is intentionally isolated from the original Rawabi
// deployment.  Do not fall back to DATABASE_URL: that variable may still be
// present in an environment copied from the original project.
const rawConnectionString = process.env.NEON_DATABASE_URL;
const connectionString = rawConnectionString
  ? normalizeConnectionString(rawConnectionString)
  : undefined;

if (!connectionString) {
  throw new Error(
    "NEON_DATABASE_URL must be set for The Levantine House. Refusing to use a shared DATABASE_URL.",
  );
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export * from "./schema";
