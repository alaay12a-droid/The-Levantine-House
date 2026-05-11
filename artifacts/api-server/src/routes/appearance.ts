import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { like } from "drizzle-orm";

const router = Router();

const KEY_PREFIX = "appearance_";
const DEFAULTS: Record<string, string> = {
  appearance_bgTheme:     "dark-brown",
  appearance_accentColor: "#E8920C",
};

// ── GET /settings/appearance ──────────────────────────────────────────────────
router.get("/settings/appearance", async (_req, res) => {
  const rows = await db.select().from(appSettingsTable).where(like(appSettingsTable.key, `${KEY_PREFIX}%`));
  const result = { ...DEFAULTS };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  res.json({
    bgTheme:     result.appearance_bgTheme,
    accentColor: result.appearance_accentColor,
  });
});

// ── PUT /settings/appearance ──────────────────────────────────────────────────
router.put("/settings/appearance", async (req, res) => {
  const { bgTheme, accentColor } = req.body as { bgTheme?: string; accentColor?: string };
  const updates: Record<string, string> = {};
  if (bgTheme)     updates.appearance_bgTheme     = bgTheme;
  if (accentColor) updates.appearance_accentColor = accentColor;
  for (const [key, value] of Object.entries(updates)) {
    await db
      .insert(appSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } });
  }
  res.json({ ok: true });
});

export default router;
