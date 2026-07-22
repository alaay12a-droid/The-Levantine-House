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

async function runMigrationsAndSeed() {
  // Run all schema migrations sequentially before seeding
  await db.execute(sql`ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS fcm_token TEXT`);
  logger.info("Migration: push_tokens.fcm_token ensured");

  await db.execute(sql`ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS driver_id INTEGER`);
  logger.info("Migration: push_tokens.driver_id ensured");

  await db.execute(sql`
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
  `);
  logger.info("Migration: referrals table ensured");

  await db.execute(sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS sizes JSONB NOT NULL DEFAULT '[]'`);
  logger.info("Migration: menu_items.sizes ensured");

  await db.execute(sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'`);
  logger.info("Migration: menu_items.options ensured");

  await db.execute(sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS calories INTEGER`);
  logger.info("Migration: menu_items.calories ensured");

  await db.execute(sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS walking_minutes INTEGER`);
  logger.info("Migration: menu_items.walking_minutes ensured");

  // Seed data after all migrations complete
  await seedMenu().catch((e) => logger.error({ err: e }, "Menu seed failed"));
  await seedOccasions().catch((e) => logger.error({ err: e }, "Occasions seed failed"));
  await seedDashboardAdmin().catch((e) => logger.error({ err: e }, "Dashboard admin seed failed"));
}

app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  runMigrationsAndSeed().catch((e) => logger.error({ err: e }, "Startup migration/seed failed"));

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
