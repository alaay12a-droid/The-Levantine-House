import { Router } from "express";
import { db, referralsTable, walletsTable, walletTransactionsTable, appSettingsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ── helpers ────────────────────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^0+/, "");
}

function generateCode(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-6);
  return `REF${digits}`;
}

async function getReferralRate(): Promise<number> {
  const [row] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "referral_rate"));
  return parseFloat(row?.value ?? "0") || 0;
}

async function isReferralEnabled(): Promise<boolean> {
  const [row] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "referral_enabled"));
  return (row?.value ?? "true") !== "false";
}

// ── GET /referrals/code?phone=xxx ─────────────────────────────────────────────
// Returns the referral code for a given phone (deterministic, no DB write).
router.get("/referrals/code", async (req, res) => {
  const phone = String(req.query.phone ?? "").trim();
  if (!phone) { res.status(400).json({ error: "phone required" }); return; }
  const code = generateCode(phone);
  res.json({ code });
});

// ── GET /referrals/stats?phone=xxx ───────────────────────────────────────────
// Returns referral statistics for the referrer.
router.get("/referrals/stats", async (req, res) => {
  const phone = normalizePhone(String(req.query.phone ?? ""));
  if (!phone) { res.status(400).json({ error: "phone required" }); return; }

  const rows = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.referrerPhone, phone))
    .orderBy(desc(referralsTable.createdAt));

  const total = rows.length;
  const rewarded = rows.filter((r) => r.rewarded).length;
  const totalRewardHalalas = rows.filter((r) => r.rewarded).reduce((s, r) => s + r.rewardAmount, 0);
  const rate = await getReferralRate();
  const enabled = await isReferralEnabled();

  res.json({ total, rewarded, totalRewardSAR: totalRewardHalalas / 100, rate, enabled, rows });
});

// ── POST /referrals/register ──────────────────────────────────────────────────
// Called when a new user completes onboarding with a referral code.
// Records the referral (not rewarded yet — reward fires on first order).
const registerSchema = z.object({
  referralCode: z.string().min(1),
  referredPhone: z.string().min(1),
  referredName: z.string().default(""),
});

router.post("/referrals/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const { referralCode, referredPhone, referredName } = parsed.data;

  const enabled = await isReferralEnabled();
  if (!enabled) { res.status(403).json({ error: "نظام الإحالات غير مفعّل حالياً" }); return; }

  const normReferred = normalizePhone(referredPhone);

  // Derive referrer phone from code (last 6 digits of phone → code = REF + digits)
  // Since the code is REF + last-6-digits, we can't reverse it perfectly, so we
  // search for any referrer whose generated code matches.
  const code = referralCode.trim().toUpperCase();
  if (!code.startsWith("REF")) { res.status(400).json({ error: "كود الإحالة غير صحيح" }); return; }

  // Try to find existing referrer by scanning referrals (referrer phones stored)
  // Alternatively, store referrer code directly. We use app_settings to store
  // a phone→code mapping created when any user registers their code.
  // Here we look up the referrer_phone from a code-index in app_settings.
  const codeKey = `referral_code_${code}`;
  const [codeRow] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, codeKey));

  if (!codeRow) { res.status(404).json({ error: "كود الإحالة غير موجود" }); return; }

  const referrerPhone = codeRow.value;
  if (normalizePhone(referrerPhone) === normReferred) {
    res.status(400).json({ error: "لا يمكن إحالة نفسك" });
    return;
  }

  // Check if this phone was already referred
  const [existing] = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.referredPhone, normReferred));
  if (existing) { res.json({ alreadyReferred: true }); return; }

  await db.insert(referralsTable).values({
    referrerPhone: normalizePhone(referrerPhone),
    referrerName: "",
    referredPhone: normReferred,
    referredName,
    rewarded: false,
  });

  res.status(201).json({ success: true });
});

// ── POST /referrals/publish-code ──────────────────────────────────────────────
// Called by the app when a user wants to share their code — stores phone→code
// mapping so it can be resolved during registration.
const publishSchema = z.object({
  phone: z.string().min(1),
  name: z.string().default(""),
});

router.post("/referrals/publish-code", async (req, res) => {
  const parsed = publishSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const { phone, name } = parsed.data;
  const norm = normalizePhone(phone);
  const code = generateCode(norm);
  const codeKey = `referral_code_${code}`;

  await db
    .insert(appSettingsTable)
    .values({ key: codeKey, value: norm })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: norm } });

  res.json({ code });
});

// ── POST /referrals/reward ────────────────────────────────────────────────────
// Internal — called from orders route when first order is placed by referred user.
export async function processReferralReward(referredPhone: string, orderId: number, referredName: string): Promise<void> {
  const norm = normalizePhone(referredPhone);

  const [referral] = await db
    .select()
    .from(referralsTable)
    .where(and(eq(referralsTable.referredPhone, norm), eq(referralsTable.rewarded, false)));

  if (!referral) return;

  const rate = await getReferralRate();
  if (rate <= 0) return;

  // rate is stored as SAR amount (integer halalas)
  const rewardHalalas = Math.round(rate * 100);
  const referrerPhone = referral.referrerPhone;

  // Credit referrer's wallet
  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.phone, referrerPhone));

  const currentBalance = wallet?.balance ?? 0;
  const newBalance = currentBalance + rewardHalalas;

  await db
    .insert(walletsTable)
    .values({ phone: referrerPhone, balance: newBalance })
    .onConflictDoUpdate({ target: walletsTable.phone, set: { balance: newBalance, updatedAt: new Date() } });

  await db.insert(walletTransactionsTable).values({
    phone: referrerPhone,
    type: "deposit",
    amount: rewardHalalas,
    balanceAfter: newBalance,
    note: `مكافأة إحالة — ${referredName || norm}`,
    orderId,
  });

  // Mark referral as rewarded
  await db
    .update(referralsTable)
    .set({ rewarded: true, rewardAmount: rewardHalalas, orderId, rewardedAt: new Date(), referredName })
    .where(eq(referralsTable.id, referral.id));
}

// ── GET /referrals/all — cashier/admin view ───────────────────────────────────
router.get("/referrals/all", async (req, res) => {
  const rows = await db
    .select()
    .from(referralsTable)
    .orderBy(desc(referralsTable.createdAt))
    .limit(200);

  // Group by referrer
  const map = new Map<string, { referrerPhone: string; total: number; rewarded: number; totalRewardSAR: number }>();
  for (const r of rows) {
    const key = r.referrerPhone;
    const existing = map.get(key) ?? { referrerPhone: key, total: 0, rewarded: 0, totalRewardSAR: 0 };
    existing.total++;
    if (r.rewarded) { existing.rewarded++; existing.totalRewardSAR += r.rewardAmount / 100; }
    map.set(key, existing);
  }

  res.json({ rows, summary: Array.from(map.values()).sort((a, b) => b.rewarded - a.rewarded) });
});

// ── GET/PUT /referrals/settings ───────────────────────────────────────────────
router.get("/referrals/settings", async (req, res) => {
  const rate = await getReferralRate();
  const enabled = await isReferralEnabled();
  res.json({ rate, enabled });
});

const settingsSchema = z.object({
  rate: z.number().min(0).optional(),
  enabled: z.boolean().optional(),
});

router.put("/referrals/settings", async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "بيانات غير صحيحة" }); return; }
  const { rate, enabled } = parsed.data;

  if (rate !== undefined) {
    await db.insert(appSettingsTable)
      .values({ key: "referral_rate", value: String(rate) })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: String(rate) } });
  }
  if (enabled !== undefined) {
    await db.insert(appSettingsTable)
      .values({ key: "referral_enabled", value: enabled ? "true" : "false" })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: enabled ? "true" : "false" } });
  }
  res.json({ success: true });
});

export default router;
