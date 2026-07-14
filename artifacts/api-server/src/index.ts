import { schedule } from "node-cron";
import app from "./app";
import { logger } from "./lib/logger";
import { seedMenu } from "./routes/menu";
import { seedOccasions } from "./routes/occasions";
import { cleanupExpiredDiscountCodes } from "./routes/discounts";
import { seedDashboardAdmin } from "./routes/dashboard-auth";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Auto-migrate: add fcm_token column if missing (idempotent)
  db.execute(sql`ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS fcm_token TEXT`)
    .then(() => logger.info("Migration: push_tokens.fcm_token ensured"))
    .catch((e) => logger.warn({ err: e }, "Migration: push_tokens.fcm_token skipped"));

  // Auto-migrate: add driver_id column if missing (idempotent)
  db.execute(sql`ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS driver_id INTEGER`)
    .then(() => logger.info("Migration: push_tokens.driver_id ensured"))
    .catch((e) => logger.warn({ err: e }, "Migration: push_tokens.driver_id skipped"));

  // Auto-migrate: create referrals table if missing
  db.execute(sql`
    CREATE TABLE IF NOT EXISTS referrals (
      id SERIAL PRIMARY KEY,
      referrer_phone TEXT NOT NULL,
      referrer_name TEXT NOT NULL DEFAULT '',
      referred_phone TEXT NOT NULL UNIQUE,
      referred_name TEXT NOT NULL DEFAULT '',
      order_id INTEGER,
      reward_amount INTEGER NOT NULL DEFAULT 0,
      rewarded BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      rewarded_at TIMESTAMP
    )
  `)
    .then(() => logger.info("Migration: referrals table ensured"))
    .catch((e) => logger.warn({ err: e }, "Migration: referrals table skipped"));

  seedMenu().catch((e) => logger.error({ err: e }, "Menu seed failed"));
  seedOccasions().catch((e) => logger.error({ err: e }, "Occasions seed failed"));
  seedDashboardAdmin().catch((e) => logger.error({ err: e }, "Dashboard admin seed failed"));

  schedule(
    "0 0 * * *",
    () => {
      cleanupExpiredDiscountCodes()
        .then((n) => logger.info({ deleted: n }, "Scheduled cleanup: expired discount codes removed"))
        .catch((e) => logger.error({ err: e }, "Scheduled cleanup: failed to remove expired discount codes"));
    },
    { timezone: "Asia/Riyadh" },
  );
  logger.info("Scheduled daily discount-code cleanup at midnight (Riyadh time)");
});
