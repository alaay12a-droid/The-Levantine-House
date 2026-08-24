import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sendPushToAll } from "../lib/sendPushNotification.js";

const router = Router();

router.get("/notifications/broadcast", async (_req, res) => {
  res.json({ sent: 0, remaining: 9999, limit: 9999 });
});

router.post("/notifications/broadcast", async (req, res) => {
  const schema = z.object({
    title: z.string().min(1).max(100),
    body:  z.string().min(1).max(300),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }

  const delivery = await sendPushToAll({
    title: parsed.data.title,
    body: parsed.data.body,
    sound: "default",
    channelId: "order-status",
    data: { type: "broadcast" },
  });

  if (delivery.error) {
    req.log.error({ title: parsed.data.title, delivery }, "Broadcast notification delivery failed");
    res.status(502).json({ error: "تعذّر التواصل مع خدمة الإشعارات" });
    return;
  }

  if (delivery.targets === 0) {
    res.status(409).json({ error: "لا توجد أجهزة عملاء مسجلة لتلقي الإشعارات" });
    return;
  }

  const complete = delivery.accepted === delivery.targets && delivery.failed === 0;
  req.log.info({ title: parsed.data.title, delivery }, "Broadcast notification dispatched");
  res.status(complete ? 200 : 207).json({
    ok: complete,
    sent: delivery.accepted,
    total: delivery.targets,
    failed: delivery.failed,
    stale: delivery.stale,
    remaining: 9999,
  });
});

export default router;
