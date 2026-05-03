import { Router } from "express";
import { db, deliveryDriversTable, orderDriverAssignmentsTable, ordersTable, appSettingsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const driverSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  photoUrl: z.string().nullable().optional(),
  photoKey: z.string().nullable().optional(),
  active: z.boolean().optional(),
  pin: z.string().min(4).max(8).optional(),
});

// ── GET /drivers ──────────────────────────────────────────────────────────────
router.get("/drivers", async (_req, res) => {
  const drivers = await db.select().from(deliveryDriversTable).orderBy(desc(deliveryDriversTable.createdAt));
  res.json(drivers);
});

// ── POST /drivers ─────────────────────────────────────────────────────────────
router.post("/drivers", async (req, res) => {
  const parsed = driverSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const [driver] = await db.insert(deliveryDriversTable).values({
    name: parsed.data.name,
    phone: parsed.data.phone,
    photoUrl: parsed.data.photoUrl ?? null,
    photoKey: parsed.data.photoKey ?? null,
    active: parsed.data.active ?? true,
    pin: parsed.data.pin ?? "0000",
  }).returning();
  res.json(driver);
});

// ── PUT /drivers/:id ──────────────────────────────────────────────────────────
router.put("/drivers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const parsed = driverSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const [driver] = await db.update(deliveryDriversTable).set(parsed.data).where(eq(deliveryDriversTable.id, id)).returning();
  res.json(driver);
});

// ── DELETE /drivers/:id ───────────────────────────────────────────────────────
router.delete("/drivers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  await db.delete(deliveryDriversTable).where(eq(deliveryDriversTable.id, id));
  res.json({ ok: true });
});

// ── POST /drivers/login ───────────────────────────────────────────────────────
router.post("/drivers/login", async (req, res) => {
  const { phone, pin } = req.body;
  if (!phone || !pin) { res.status(400).json({ error: "أدخل رقم الجوال والرقم السري" }); return; }
  const [driver] = await db.select().from(deliveryDriversTable)
    .where(and(eq(deliveryDriversTable.phone, String(phone)), eq(deliveryDriversTable.pin, String(pin))));
  if (!driver) { res.status(401).json({ error: "رقم الجوال أو الرقم السري غير صحيح" }); return; }
  if (!driver.active) { res.status(403).json({ error: "حسابك موقوف، تواصل مع المشرف" }); return; }
  res.json(driver);
});

// ── GET /drivers/:id/orders ───────────────────────────────────────────────────
router.get("/drivers/:id/orders", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const rows = await db
    .select({
      assignment: orderDriverAssignmentsTable,
      order: ordersTable,
    })
    .from(orderDriverAssignmentsTable)
    .leftJoin(ordersTable, eq(orderDriverAssignmentsTable.orderId, ordersTable.id))
    .where(eq(orderDriverAssignmentsTable.driverId, id))
    .orderBy(desc(orderDriverAssignmentsTable.assignedAt));
  res.json(rows);
});

// ── POST /orders/:id/assign-driver ────────────────────────────────────────────
router.post("/orders/:id/assign-driver", async (req, res) => {
  const orderId = parseInt(req.params.id);
  if (isNaN(orderId)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const { driverId } = req.body;
  if (!driverId) { res.status(400).json({ error: "اختر مندوباً" }); return; }
  const [assignment] = await db
    .insert(orderDriverAssignmentsTable)
    .values({ orderId, driverId: parseInt(driverId), status: "assigned" })
    .onConflictDoUpdate({
      target: orderDriverAssignmentsTable.orderId,
      set: { driverId: parseInt(driverId), status: "assigned", assignedAt: new Date() },
    })
    .returning();
  res.json(assignment);
});

// ── DELETE /orders/:id/assign-driver ─────────────────────────────────────────
router.delete("/orders/:id/assign-driver", async (req, res) => {
  const orderId = parseInt(req.params.id);
  if (isNaN(orderId)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  await db.delete(orderDriverAssignmentsTable).where(eq(orderDriverAssignmentsTable.orderId, orderId));
  res.json({ ok: true });
});

// ── PUT /orders/:id/driver-status ─────────────────────────────────────────────
router.put("/orders/:id/driver-status", async (req, res) => {
  const orderId = parseInt(req.params.id);
  if (isNaN(orderId)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const { status } = req.body;
  if (!["assigned", "picked_up", "delivered"].includes(status)) {
    res.status(400).json({ error: "حالة غير صحيحة" }); return;
  }
  const set: Record<string, unknown> = { status };
  if (status === "picked_up") set.pickedUpAt = new Date();
  if (status === "delivered") set.deliveredAt = new Date();
  const [assignment] = await db
    .update(orderDriverAssignmentsTable)
    .set(set)
    .where(eq(orderDriverAssignmentsTable.orderId, orderId))
    .returning();
  res.json(assignment);
});

// ── GET /orders/:id/assignment ────────────────────────────────────────────────
router.get("/orders/:id/assignment", async (req, res) => {
  const orderId = parseInt(req.params.id);
  if (isNaN(orderId)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const [row] = await db
    .select({ assignment: orderDriverAssignmentsTable, driver: deliveryDriversTable })
    .from(orderDriverAssignmentsTable)
    .leftJoin(deliveryDriversTable, eq(orderDriverAssignmentsTable.driverId, deliveryDriversTable.id))
    .where(eq(orderDriverAssignmentsTable.orderId, orderId));
  res.json(row ?? null);
});

// ── PUT /orders/:id/driver-location ──────────────────────────────────────────
router.put("/orders/:id/driver-location", async (req, res) => {
  const orderId = parseInt(req.params.id);
  if (isNaN(orderId)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const { lat, lng } = req.body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    res.status(400).json({ error: "إحداثيات غير صحيحة" }); return;
  }
  const [assignment] = await db
    .update(orderDriverAssignmentsTable)
    .set({ driverLat: lat, driverLng: lng, locationUpdatedAt: new Date() })
    .where(eq(orderDriverAssignmentsTable.orderId, orderId))
    .returning();
  res.json(assignment);
});

// ── GET /settings/ui-density ──────────────────────────────────────────────────
router.get("/settings/ui-density", async (_req, res) => {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "ui_density"));
  res.json({ value: row?.value ?? "normal" });
});

// ── PUT /settings/ui-density ──────────────────────────────────────────────────
router.put("/settings/ui-density", async (req, res) => {
  const { value } = req.body;
  if (!["compact", "normal", "spacious"].includes(value)) {
    res.status(400).json({ error: "قيمة غير صحيحة" }); return;
  }
  await db.insert(appSettingsTable)
    .values({ key: "ui_density", value })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } });
  res.json({ value });
});

// ── GET /settings/drivers-enabled ────────────────────────────────────────────
router.get("/settings/drivers-enabled", async (_req, res) => {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "drivers_enabled"));
  const enabled = row ? row.value !== "false" : false;
  res.json({ enabled });
});

// ── PUT /settings/drivers-enabled ────────────────────────────────────────────
router.put("/settings/drivers-enabled", async (req, res) => {
  const { enabled } = req.body;
  await db.insert(appSettingsTable)
    .values({ key: "drivers_enabled", value: String(!!enabled) })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: String(!!enabled), updatedAt: new Date() } });
  res.json({ enabled: !!enabled });
});

export default router;
