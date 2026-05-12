import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { like } from "drizzle-orm";

const router = Router();

const KEY_PREFIX = "appearance_";
const DEFAULTS: Record<string, string> = {
  appearance_bgTheme:        "dark-brown",
  appearance_accentColor:    "#E8920C",
  appearance_logoBg:         "#1F130A",
  appearance_minOrderAmount: "0",
};

// ── GET /settings/appearance ──────────────────────────────────────────────────
router.get("/settings/appearance", async (_req, res) => {
  const rows = await db.select().from(appSettingsTable).where(like(appSettingsTable.key, `${KEY_PREFIX}%`));
  const result = { ...DEFAULTS };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  res.json({
    bgTheme:        result.appearance_bgTheme,
    accentColor:    result.appearance_accentColor,
    logoBg:         result.appearance_logoBg,
    minOrderAmount: parseFloat(result.appearance_minOrderAmount) || 0,
  });
});

// ── PUT /settings/appearance ──────────────────────────────────────────────────
router.put("/settings/appearance", async (req, res) => {
  const { bgTheme, accentColor, logoBg, minOrderAmount } = req.body as {
    bgTheme?: string;
    accentColor?: string;
    logoBg?: string;
    minOrderAmount?: number;
  };
  const updates: Record<string, string> = {};
  if (bgTheme !== undefined)        updates.appearance_bgTheme        = bgTheme;
  if (accentColor !== undefined)    updates.appearance_accentColor    = accentColor;
  if (logoBg !== undefined)         updates.appearance_logoBg         = logoBg;
  if (minOrderAmount !== undefined) updates.appearance_minOrderAmount = String(minOrderAmount);
  for (const [key, value] of Object.entries(updates)) {
    await db
      .insert(appSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } });
  }
  res.json({ ok: true });
});

export default router;
