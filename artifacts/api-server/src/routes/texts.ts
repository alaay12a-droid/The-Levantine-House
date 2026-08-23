import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { like } from "drizzle-orm";

const router = Router();

const DEFAULTS: Record<string, string> = {
  txt_name:             "البيت الشامي",
  txt_name_en:          "The Levantine House",
  txt_tagline:          "طعم الشام في كل طبق",
  txt_tagline_en:       "The taste of the Levant in every dish",
  txt_phone:            "",
  txt_whatsapp:         "",
  txt_location:         "",
  txt_location_en:      "",
  txt_instagram:        "",
  txt_dhabiha_phone:    "",
  txt_dhabiha_whatsapp: "",
  txt_announcement:     "",
  txt_delivery_area:    "",
};

// ── GET /app-texts ─────────────────────────────────────────────────────────────
router.get("/app-texts", async (_req, res) => {
  const rows = await db.select().from(appSettingsTable).where(like(appSettingsTable.key, "txt_%"));
  const result = { ...DEFAULTS };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  res.json(result);
});

// ── PUT /app-texts ─────────────────────────────────────────────────────────────
router.put("/app-texts", async (req, res) => {
  const updates = req.body as Record<string, string>;
  if (!updates || typeof updates !== "object") {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }
  for (const [key, value] of Object.entries(updates)) {
    if (!key.startsWith("txt_")) continue;
    await db
      .insert(appSettingsTable)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: String(value), updatedAt: new Date() } });
  }
  res.json({ ok: true });
});

export default router;
