import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const KEYS = {
  version: "app_version_customer",
  url: "app_version_customer_url",
  force: "app_version_customer_force",
};

async function getSetting(key: string, fallback: string): Promise<string> {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key)).limit(1);
  return row?.value ?? fallback;
}

async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } });
}

router.get("/version", async (_req, res) => {
  try {
    const [latestVersion, downloadUrl, forceUpdate] = await Promise.all([
      getSetting(KEYS.version, "1.2.0"),
      getSetting(KEYS.url, ""),
      getSetting(KEYS.force, "false"),
    ]);
    res.json({ latestVersion, downloadUrl, forceUpdate: forceUpdate === "true" });
  } catch {
    res.status(500).json({ error: "تعذر جلب معلومات الإصدار" });
  }
});

const updateSchema = z.object({
  latestVersion: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
  downloadUrl: z.string().url().optional(),
  forceUpdate: z.boolean().optional(),
});

router.put("/version", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }
  try {
    const { latestVersion, downloadUrl, forceUpdate } = parsed.data;
    await Promise.all([
      latestVersion !== undefined ? setSetting(KEYS.version, latestVersion) : Promise.resolve(),
      downloadUrl !== undefined ? setSetting(KEYS.url, downloadUrl) : Promise.resolve(),
      forceUpdate !== undefined ? setSetting(KEYS.force, String(forceUpdate)) : Promise.resolve(),
    ]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "تعذر تحديث الإصدار" });
  }
});

export default router;
