import { Router } from "express";
import { db, deliveryDriversTable, orderDriverAssignmentsTable, ordersTable, appSettingsTable, messagesTable } from "@workspace/db";
import { eq, desc, and, gte, lt, ne } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const cleanPhone = (p: string) => p.replace(/[^\d+]/g, "").trim();

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
    phone: cleanPhone(parsed.data.phone),
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
  const updateData = { ...parsed.data, ...(parsed.data.phone ? { phone: cleanPhone(parsed.data.phone) } : {}) };
  const [driver] = await db.update(deliveryDriversTable).set(updateData).where(eq(deliveryDriversTable.id, id)).returning();
  res.json(driver);
});

// ── DELETE /drivers/:id ───────────────────────────────────────────────────────
router.delete("/drivers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  await db.delete(messagesTable).where(eq(messagesTable.driverId, id));
  await db.delete(orderDriverAssignmentsTable).where(eq(orderDriverAssignmentsTable.driverId, id));
  await db.delete(deliveryDriversTable).where(eq(deliveryDriversTable.id, id));
  res.json({ ok: true });
});

// ── POST /drivers/login ───────────────────────────────────────────────────────
router.post("/drivers/login", async (req, res) => {
  const { phone, pin } = req.body;
  if (!phone || !pin) { res.status(400).json({ error: "أدخل رقم الجوال والرقم السري" }); return; }
  const normalizedPhone = cleanPhone(String(phone));
  const [driver] = await db.select().from(deliveryDriversTable)
    .where(and(eq(deliveryDriversTable.phone, normalizedPhone), eq(deliveryDriversTable.pin, String(pin).trim())));
  if (!driver) { res.status(401).json({ error: "رقم الجوال أو الرقم السري غير صحيح" }); return; }
  if (!driver.active) { res.status(403).json({ error: "حسابك موقوف، تواصل مع المشرف" }); return; }
  res.json(driver);
});

// ── GET /drivers/active-assignments  (all picked_up — cashier view) ──────────
router.get("/drivers/active-assignments", async (_req, res) => {
  const rows = await db
    .select({ assignment: orderDriverAssignmentsTable, order: ordersTable, driver: deliveryDriversTable })
    .from(orderDriverAssignmentsTable)
    .leftJoin(ordersTable, eq(orderDriverAssignmentsTable.orderId, ordersTable.id))
    .leftJoin(deliveryDriversTable, eq(orderDriverAssignmentsTable.driverId, deliveryDriversTable.id))
    .where(eq(orderDriverAssignmentsTable.status, "picked_up"))
    .orderBy(desc(orderDriverAssignmentsTable.pickedUpAt));
  res.json(rows.map(r => ({
    orderId: r.assignment.orderId,
    driverId: r.assignment.driverId,
    pickedUpAt: r.assignment.pickedUpAt,
    driverName: r.driver?.name ?? "مندوب",
    driverPhone: r.driver?.phone ?? "",
    dailyNumber: r.order?.dailyNumber ?? null,
    customerName: r.order?.customerName ?? "",
    customerAddress: r.order?.customerAddress ?? null,
    totalPrice: (r.order?.totalPrice ?? 0) / 100,
    paymentMethod: r.order?.paymentMethod ?? "cash",
  })));
});

// ── GET /drivers/daily-summaries  (all drivers — admin view) ─────────────────
router.get("/drivers/daily-summaries", async (_req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const drivers = await db.select().from(deliveryDriversTable).orderBy(deliveryDriversTable.name);
  const results = await Promise.all(drivers.map(async (driver) => {
    const rows = await db
      .select({ assignment: orderDriverAssignmentsTable, order: ordersTable })
      .from(orderDriverAssignmentsTable)
      .leftJoin(ordersTable, eq(orderDriverAssignmentsTable.orderId, ordersTable.id))
      .where(and(
        eq(orderDriverAssignmentsTable.driverId, driver.id),
        eq(orderDriverAssignmentsTable.status, "delivered"),
        gte(orderDriverAssignmentsTable.deliveredAt, today),
        lt(orderDriverAssignmentsTable.deliveredAt, tomorrow),
      ))
      .orderBy(desc(orderDriverAssignmentsTable.deliveredAt));

    const totalCollected = rows.reduce((s, r) => s + (r.order?.totalPrice ?? 0), 0);
    return {
      driver: { id: driver.id, name: driver.name, phone: driver.phone, photoUrl: driver.photoUrl, active: driver.active },
      ordersCount: rows.length,
      totalCollected: totalCollected / 100,
      orders: rows.map(r => ({
        orderId: r.assignment.orderId,
        dailyNumber: r.order?.dailyNumber ?? null,
        customerName: r.order?.customerName ?? "",
        totalPrice: (r.order?.totalPrice ?? 0) / 100,
        deliveredAt: r.assignment.deliveredAt,
      })),
    };
  }));
  res.json(results);
});

// ── GET /drivers/:id/statement  (full history + cancelled orders) ─────────────
router.get("/drivers/:id/statement", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }

  // Delivered orders
  const deliveredRows = await db
    .select({ assignment: orderDriverAssignmentsTable, order: ordersTable })
    .from(orderDriverAssignmentsTable)
    .leftJoin(ordersTable, eq(orderDriverAssignmentsTable.orderId, ordersTable.id))
    .where(and(
      eq(orderDriverAssignmentsTable.driverId, id),
      eq(orderDriverAssignmentsTable.status, "delivered"),
    ))
    .orderBy(desc(orderDriverAssignmentsTable.deliveredAt));

  // Cancelled orders that were once assigned to this driver
  const cancelledRows = await db
    .select({ assignment: orderDriverAssignmentsTable, order: ordersTable })
    .from(orderDriverAssignmentsTable)
    .leftJoin(ordersTable, eq(orderDriverAssignmentsTable.orderId, ordersTable.id))
    .where(and(
      eq(orderDriverAssignmentsTable.driverId, id),
      ne(orderDriverAssignmentsTable.status, "delivered"),
      eq(ordersTable.status, "cancelled"),
    ))
    .orderBy(desc(orderDriverAssignmentsTable.assignedAt));

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart  = new Date(now.getFullYear(), 0, 1);

  type PeriodAcc = { ordersCount: number; totalCollected: number; cashCollected: number; electronicCollected: number; cancelledCount: number };
  const mkPeriod = (): PeriodAcc => ({ ordersCount: 0, totalCollected: 0, cashCollected: 0, electronicCollected: 0, cancelledCount: 0 });
  const today     = mkPeriod();
  const thisMonth = mkPeriod();
  const thisYear  = mkPeriod();
  const allTime   = mkPeriod();

  type DayOrder = { orderId: number; dailyNumber: number | null; customerName: string; totalPrice: number; paymentMethod: string; assignedAt: string | null; pickedUpAt: string | null; deliveredAt: string | null; cancelled: boolean };
  const dayMap = new Map<string, { ordersCount: number; totalCollected: number; cashCollected: number; electronicCollected: number; cancelledCount: number; orders: DayOrder[] }>();
  const ensureDay = (key: string) => {
    if (!dayMap.has(key)) dayMap.set(key, { ordersCount: 0, totalCollected: 0, cashCollected: 0, electronicCollected: 0, cancelledCount: 0, orders: [] });
    return dayMap.get(key)!;
  };

  // Process delivered
  for (const r of deliveredRows) {
    const deliveredAt = r.assignment.deliveredAt;
    if (!deliveredAt) continue;
    const d = new Date(deliveredAt);
    const price = (r.order?.totalPrice ?? 0) / 100;
    const pm = r.order?.paymentMethod ?? "cash";
    const isCash = pm === "cash";

    const addTo = (acc: PeriodAcc) => {
      acc.ordersCount++;
      acc.totalCollected += price;
      if (isCash) acc.cashCollected += price; else acc.electronicCollected += price;
    };
    addTo(allTime);
    if (d >= yearStart)  addTo(thisYear);
    if (d >= monthStart) addTo(thisMonth);
    if (d >= todayStart) addTo(today);

    const dayKey = d.toISOString().slice(0, 10);
    const day = ensureDay(dayKey);
    day.ordersCount++;
    day.totalCollected += price;
    if (isCash) day.cashCollected += price; else day.electronicCollected += price;
    day.orders.push({
      orderId: r.assignment.orderId,
      dailyNumber: r.order?.dailyNumber ?? null,
      customerName: r.order?.customerName ?? "",
      totalPrice: price,
      paymentMethod: pm,
      assignedAt: r.assignment.assignedAt ? r.assignment.assignedAt.toISOString() : null,
      pickedUpAt: r.assignment.pickedUpAt ? r.assignment.pickedUpAt.toISOString() : null,
      deliveredAt: deliveredAt.toISOString(),
      cancelled: false,
    });
  }

  // Process cancelled
  for (const r of cancelledRows) {
    const refDate = r.assignment.assignedAt ?? r.order?.createdAt;
    if (!refDate) continue;
    const d = new Date(refDate);

    allTime.cancelledCount++;
    if (d >= yearStart)  thisYear.cancelledCount++;
    if (d >= monthStart) thisMonth.cancelledCount++;
    if (d >= todayStart) today.cancelledCount++;

    const dayKey = d.toISOString().slice(0, 10);
    const day = ensureDay(dayKey);
    day.cancelledCount++;
    day.orders.push({
      orderId: r.assignment.orderId,
      dailyNumber: r.order?.dailyNumber ?? null,
      customerName: r.order?.customerName ?? "",
      totalPrice: 0,
      paymentMethod: r.order?.paymentMethod ?? "cash",
      assignedAt: r.assignment.assignedAt ? r.assignment.assignedAt.toISOString() : null,
      pickedUpAt: null,
      deliveredAt: null,
      cancelled: true,
    });
  }

  const daily = Array.from(dayMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, v]) => ({ date, ...v }));

  res.json({ today, thisMonth, thisYear, allTime, daily });
});

// ── GET /drivers/:id/daily-summary ───────────────────────────────────────────
router.get("/drivers/:id/daily-summary", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const rows = await db
    .select({ assignment: orderDriverAssignmentsTable, order: ordersTable })
    .from(orderDriverAssignmentsTable)
    .leftJoin(ordersTable, eq(orderDriverAssignmentsTable.orderId, ordersTable.id))
    .where(and(
      eq(orderDriverAssignmentsTable.driverId, id),
      eq(orderDriverAssignmentsTable.status, "delivered"),
      gte(orderDriverAssignmentsTable.deliveredAt, today),
      lt(orderDriverAssignmentsTable.deliveredAt, tomorrow),
    ))
    .orderBy(desc(orderDriverAssignmentsTable.deliveredAt));

  const totalCollected = rows.reduce((s, r) => s + (r.order?.totalPrice ?? 0), 0);
  res.json({
    ordersCount: rows.length,
    totalCollected: totalCollected / 100,
    orders: rows.map(r => ({
      orderId: r.assignment.orderId,
      dailyNumber: r.order?.dailyNumber ?? null,
      customerName: r.order?.customerName ?? "",
      totalPrice: (r.order?.totalPrice ?? 0) / 100,
      deliveredAt: r.assignment.deliveredAt,
    })),
  });
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

// ── POST /orders/:id/driver-rating ────────────────────────────────────────────
router.post("/orders/:id/driver-rating", async (req, res) => {
  const orderId = parseInt(req.params.id);
  if (isNaN(orderId)) { res.status(400).json({ error: "معرّف غير صحيح" }); return; }
  const stars = parseInt(req.body.stars);
  if (isNaN(stars) || stars < 1 || stars > 5) {
    res.status(400).json({ error: "تقييم غير صحيح (1-5)" }); return;
  }
  const [row] = await db
    .update(orderDriverAssignmentsTable)
    .set({ driverRating: stars })
    .where(eq(orderDriverAssignmentsTable.orderId, orderId))
    .returning();
  if (!row) { res.status(404).json({ error: "لم يُوجد تعيين" }); return; }
  res.json({ ok: true, stars });
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

// ── GET /settings/commission-rate ─────────────────────────────────────────────
router.get("/settings/commission-rate", async (_req, res) => {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "commission_rate"));
  res.json({ rate: row ? parseFloat(row.value) : 5 });
});

// ── PUT /settings/commission-rate ─────────────────────────────────────────────
router.put("/settings/commission-rate", async (req, res) => {
  const rate = parseFloat(req.body.rate);
  if (isNaN(rate) || rate < 0 || rate > 100) {
    res.status(400).json({ error: "نسبة غير صحيحة" }); return;
  }
  await db.insert(appSettingsTable)
    .values({ key: "commission_rate", value: String(rate) })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: String(rate), updatedAt: new Date() } });
  res.json({ rate });
});

// ── GET /map/:orderId  (live driver tracking HTML page) ───────────────────────
router.get("/map/:orderId", async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  if (isNaN(orderId)) { res.status(400).send("معرّف غير صحيح"); return; }

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <title>تتبع المندوب</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;background:#0D1117;font-family:Cairo,sans-serif;overflow:hidden}
    #map{width:100%;height:100vh}
    #status{
      position:fixed;top:12px;left:50%;transform:translateX(-50%);
      background:rgba(13,32,48,0.92);color:#29B6F6;
      font-size:13px;font-weight:700;padding:7px 18px;border-radius:20px;
      border:1px solid #29B6F644;z-index:1000;white-space:nowrap;
      display:flex;align-items:center;gap:8px;
    }
    .dot{width:8px;height:8px;border-radius:50%;background:#4CAF50;animation:blink 1.2s infinite}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
    .pulse-ring{
      width:50px;height:50px;border-radius:50%;
      background:rgba(41,182,246,.18);border:2px solid #29B6F6;
      display:flex;align-items:center;justify-content:center;
      animation:pulse 1.8s ease-in-out infinite;
    }
    @keyframes pulse{
      0%{box-shadow:0 0 0 0 rgba(41,182,246,.5)}
      70%{box-shadow:0 0 0 16px rgba(41,182,246,0)}
      100%{box-shadow:0 0 0 0 rgba(41,182,246,0)}
    }
    .scooter{font-size:28px;line-height:1}
    .no-loc{
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      text-align:center;color:#aaa;display:none;
    }
    .no-loc span{font-size:48px;display:block;margin-bottom:12px}
    .leaflet-tile{filter:brightness(.82) saturate(.9)}
  </style>
</head>
<body>
<div id="map"></div>
<div id="status"><div class="dot"></div><span id="statusText">جاري تحديد موقع المندوب...</span></div>
<div class="no-loc" id="noLoc"><span>📍</span>لم يشارك المندوب موقعه بعد</div>
<script>
  var ORDER_ID = ${orderId};
  var POLL_MS  = 10000;
  var map = null, driverMarker = null;
  var curLat = null, curLng = null, animReq = null;

  var driverIcon = L.divIcon({
    html: '<div class="pulse-ring"><div class="scooter">🛵</div></div>',
    iconSize:[50,50], iconAnchor:[25,25], className:''
  });

  function initMap(lat, lng) {
    map = L.map('map',{zoomControl:true,attributionControl:false});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    curLat = lat; curLng = lng;
    driverMarker = L.marker([lat,lng],{icon:driverIcon}).addTo(map);
    map.setView([lat,lng],15);
    document.getElementById('statusText').textContent = 'موقع مباشر • يُحدَّث كل 10 ثوانٍ';
    document.getElementById('noLoc').style.display = 'none';
  }

  function animateTo(tLat, tLng) {
    var STEPS = 40;
    var sLat = curLat, sLng = curLng;
    var step = 0;
    if (animReq) cancelAnimationFrame(animReq);
    function frame() {
      step++;
      var t = step/STEPS;
      curLat = sLat + (tLat-sLat)*t;
      curLng = sLng + (tLng-sLng)*t;
      driverMarker.setLatLng([curLat,curLng]);
      if (step < STEPS) animReq = requestAnimationFrame(frame);
      else { curLat=tLat; curLng=tLng; }
    }
    frame();
    if (!map.getBounds().contains([tLat,tLng])) {
      map.panTo([tLat,tLng],{animate:true,duration:1});
    }
  }

  async function poll() {
    try {
      var r = await fetch('/api/orders/'+ORDER_ID+'/assignment');
      if (!r.ok) return;
      var data = await r.json();
      if (!data || !data.assignment) return;
      var lat = data.assignment.driverLat;
      var lng = data.assignment.driverLng;
      if (!lat || !lng) {
        document.getElementById('noLoc').style.display = 'block';
        return;
      }
      document.getElementById('noLoc').style.display = 'none';
      if (!map) { initMap(lat, lng); }
      else { animateTo(lat, lng); }
    } catch(e){}
  }

  poll();
  setInterval(poll, POLL_MS);
</script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(html);
});

export default router;
