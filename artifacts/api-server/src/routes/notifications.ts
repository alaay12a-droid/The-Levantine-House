import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sendPushToAll } from "../lib/sendPushNotification.js";

const router = Router();

const WEEKLY_LIMIT = 4;
const SETTING_KEY  = "broadcast_weekly";

function currentWeekKey(): string {
  const now  = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

interface WeeklyRecord { week: string; count: number }

async function getWeeklyRecord(): Promise<WeeklyRecord> {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, SETTING_KEY));
  if (!row) return { week: currentWeekKey(), count: 0 };
  try {
    const parsed = JSON.parse(row.value) as WeeklyRecord;
    if (parsed.week !== currentWeekKey()) return { week: currentWeekKey(), count: 0 };
    return parsed;
  } catch {
    return { week: currentWeekKey(), count: 0 };
  }
}

async function saveWeeklyRecord(record: WeeklyRecord): Promise<void> {
  await db.insert(appSettingsTable)
    .values({ key: SETTING_KEY, value: JSON.stringify(record) })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: JSON.stringify(record), updatedAt: new Date() } });
}

router.get("/notifications/broadcast", async (req, res) => {
  const record = await getWeeklyRecord();
  res.json({ sent: record.count, remaining: Math.max(0, WEEKLY_LIMIT - record.count), limit: WEEKLY_LIMIT });
});

router.post("/notifications/broadcast", async (req, res) => {
  const schema = z.object({
    title: z.string().min(1).max(100),
    body:  z.string().min(1).max(300),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  const record = await getWeeklyRecord();
  if (record.count >= WEEKLY_LIMIT) {
    res.status(429).json({ error: `وصلت للحد الأقصى ${WEEKLY_LIMIT} إشعارات هذا الأسبوع` }); return;
  }

  await sendPushToAll({ title: parsed.data.title, body: parsed.data.body, sound: "default" });

  record.count += 1;
  await saveWeeklyRecord(record);

  req.log.info({ title: parsed.data.title, count: record.count }, "Broadcast notification sent");
  res.json({ ok: true, remaining: Math.max(0, WEEKLY_LIMIT - record.count) });
});

export default router;
