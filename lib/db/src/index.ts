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

const rawConnectionString =
  process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
const connectionString = rawConnectionString
  ? normalizeConnectionString(rawConnectionString)
  : undefined;

if (!connectionString) {
  throw new Error(
    "NEON_DATABASE_URL or DATABASE_URL must be set. Did you forget to configure a database?",
  );
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export * from "./schema";
