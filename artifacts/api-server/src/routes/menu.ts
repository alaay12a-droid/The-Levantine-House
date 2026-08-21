import { Router } from "express";
import { db, appSettingsTable, menuItemsTable } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";
import { ObjectStorageService } from "../lib/objectStorage";
import { requireDashboardAdmin, requireSameOriginDashboardRequest } from "./dashboard-auth";

const objectStorageService = new ObjectStorageService();

const router = Router();
const CATEGORY_SETTINGS_KEY = "menu_categories_v1";

type MenuCategory = {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  imageUrl: string | null;
  isVisible: boolean;
  sortOrder: number;
};

const LEGACY_CATEGORY_META: Record<string, Omit<MenuCategory, "id" | "sortOrder">> = {
  chicken: { name: "الدجاج", nameEn: "Chicken", icon: "🍗", imageUrl: null, isVisible: true },
  meat: { name: "اللحوم", nameEn: "Meat", icon: "🥩", imageUrl: null, isVisible: true },
  mains: { name: "الأطباق الرئيسية", nameEn: "Main Dishes", icon: "🍽️", imageUrl: null, isVisible: true },
  sides: { name: "الإيدامات", nameEn: "Sides", icon: "🥘", imageUrl: null, isVisible: true },
  salads: { name: "السلطات", nameEn: "Salads", icon: "🥗", imageUrl: null, isVisible: true },
  desserts: { name: "الحلويات", nameEn: "Desserts", icon: "🍮", imageUrl: null, isVisible: true },
  drinks: { name: "المشروبات", nameEn: "Drinks", icon: "🥤", imageUrl: null, isVisible: true },
  extras: { name: "إضافات", nameEn: "Extras", icon: "✨", imageUrl: null, isVisible: true },
  "الدجاج": { name: "الدجاج", nameEn: "Chicken", icon: "🍗", imageUrl: null, isVisible: true },
  "اللحوم": { name: "اللحوم", nameEn: "Meat", icon: "🥩", imageUrl: null, isVisible: true },
  "المشويات": { name: "المشويات", nameEn: "Grills", icon: "🔥", imageUrl: null, isVisible: true },
  "المقبلات": { name: "المقبلات", nameEn: "Appetizers", icon: "🥙", imageUrl: null, isVisible: true },
  "السلطات": { name: "السلطات", nameEn: "Salads", icon: "🥗", imageUrl: null, isVisible: true },
  "المشروبات": { name: "المشروبات", nameEn: "Drinks", icon: "🥤", imageUrl: null, isVisible: true },
  "العصائر": { name: "العصائر", nameEn: "Juices", icon: "🧃", imageUrl: null, isVisible: true },
  "المناسبات": { name: "المناسبات", nameEn: "Occasions", icon: "🎉", imageUrl: null, isVisible: true },
};

const CATEGORY_ORDER = ["chicken", "meat", "mains", "sides", "salads", "desserts", "drinks", "extras"];

function defaultCategory(id: string, sortOrder: number): MenuCategory {
  const legacy = LEGACY_CATEGORY_META[id];
  return {
    id,
    name: legacy?.name ?? id,
    nameEn: legacy?.nameEn ?? id,
    icon: legacy?.icon ?? "🍽️",
    imageUrl: legacy?.imageUrl ?? null,
    isVisible: legacy?.isVisible ?? true,
    sortOrder,
  };
}

function orderCategories(categories: MenuCategory[]): MenuCategory[] {
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ar"));
}

async function saveCategories(categories: MenuCategory[]) {
  await db
    .insert(appSettingsTable)
    .values({ key: CATEGORY_SETTINGS_KEY, value: JSON.stringify(orderCategories(categories)) })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value: JSON.stringify(orderCategories(categories)), updatedAt: new Date() },
    });
}

async function getCategories(): Promise<MenuCategory[]> {
  const [settingsRow, itemRows] = await Promise.all([
    db.select().from(appSettingsTable).where(eq(appSettingsTable.key, CATEGORY_SETTINGS_KEY)),
    db.select({ category: menuItemsTable.category }).from(menuItemsTable),
  ]);

  let savedCategories: MenuCategory[] = [];
  try {
    const parsed = JSON.parse(settingsRow[0]?.value ?? "[]");
    if (Array.isArray(parsed)) {
      savedCategories = parsed
        .filter((category): category is Partial<MenuCategory> & { id: string; name: string } =>
          typeof category?.id === "string" && typeof category.name === "string",
        )
        .map((category, index) => ({
          ...defaultCategory(category.id, index),
          ...category,
          nameEn: typeof category.nameEn === "string" ? category.nameEn : category.name,
          icon: typeof category.icon === "string" && category.icon.trim() ? category.icon : "🍽️",
          imageUrl: typeof category.imageUrl === "string" ? category.imageUrl : null,
          isVisible: category.isVisible !== false,
          sortOrder: typeof category.sortOrder === "number" && Number.isInteger(category.sortOrder) ? category.sortOrder : index,
        }));
    }
  } catch {
    savedCategories = [];
  }

  const categoryIds = [...new Set(itemRows.map((row) => row.category))].sort((a, b) => {
    const aIndex = CATEGORY_ORDER.indexOf(a);
    const bIndex = CATEGORY_ORDER.indexOf(b);
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex) || a.localeCompare(b, "ar");
  });
  const knownIds = new Set(savedCategories.map((category) => category.id));
  const missing = categoryIds
    .filter((id) => !knownIds.has(id))
    .map((id, index) => defaultCategory(id, savedCategories.length + index));
  const categories = orderCategories([...savedCategories, ...missing]);

  if (!settingsRow[0] || missing.length > 0 || categories.length !== savedCategories.length) {
    await saveCategories(categories);
  }

  return categories;
}

const INITIAL_ITEMS = [
  { itemId: "c1",   name: "مندي دجاج حبة كاملة مع الرز",    nameEn: "Whole Chicken Mandi with Rice",       category: "chicken",  price: 4400,   imageKey: "chicken_mandi_new",  sortOrder: 1  },
  { itemId: "c2",   name: "مندي دجاج نص حبة مع الرز",       nameEn: "Half Chicken Mandi with Rice",        category: "chicken",  price: 2200,   imageKey: "chicken_mandi_new",  sortOrder: 2  },
  { itemId: "ma1",  name: "مضغوط دجاج حبة كاملة مع الرز",   nameEn: "Whole Chicken Maqbous with Rice",     category: "chicken",  price: 4400,   imageKey: "maqbous_chicken",    sortOrder: 3  },
  { itemId: "ma2",  name: "مضغوط دجاج نص حبة مع الرز",      nameEn: "Half Chicken Maqbous with Rice",      category: "chicken",  price: 2200,   imageKey: "maqbous_half",       sortOrder: 4  },
  { itemId: "ma3",  name: "دجاج مدفون حبة كاملة مع الرز",   nameEn: "Whole Buried Chicken with Rice",      category: "chicken",  price: 4400,   imageKey: "mdfoon_chicken",     sortOrder: 5  },
  { itemId: "ma4",  name: "دجاج مدفون نص حبة مع الرز",      nameEn: "Half Buried Chicken with Rice",       category: "chicken",  price: 2200,   imageKey: "mdfoon_chicken",     sortOrder: 6  },
  { itemId: "c5",   name: "نص حبة على الفحم مع الرز",        nameEn: "Half Grilled Chicken with Rice",      category: "chicken",  price: 2200,   imageKey: "chicken_grill",      sortOrder: 7  },
  { itemId: "c6",   name: "حبة على الفحم مع الرز",           nameEn: "Whole Grilled Chicken with Rice",     category: "chicken",  price: 4400,   imageKey: "chicken_grill",      sortOrder: 8  },
  { itemId: "c7",   name: "نص حبة على الفحم سادة",           nameEn: "Half Grilled Chicken Plain",          category: "chicken",  price: 1500,   imageKey: "chicken_grill",      sortOrder: 9  },
  { itemId: "c8",   name: "حبة على الفحم سادة",              nameEn: "Whole Grilled Chicken Plain",         category: "chicken",  price: 3000,   imageKey: "chicken_grill",      sortOrder: 10 },
  { itemId: "c3",   name: "رز مندي",                         nameEn: "Mandi Rice",                          category: "chicken",  price: 700,    imageKey: "rice_mandi",         sortOrder: 11 },
  { itemId: "c4",   name: "رز بشاور",                        nameEn: "Peshawar Rice",                       category: "chicken",  price: 700,    imageKey: "rice",               sortOrder: 12 },
  { itemId: "m1",   name: "لحم مندي بلدي - تيس كامل",        nameEn: "Local Lamb Mandi - Whole Goat",       category: "meat",     price: 140000, imageKey: "goat_mandi",         sortOrder: 1  },
  { itemId: "m2",   name: "لحم مندي بلدي - نص تيس",          nameEn: "Local Lamb Mandi - Half Goat",        category: "meat",     price: 70000,  imageKey: "goat_mandi",         sortOrder: 2  },
  { itemId: "m3",   name: "لحم مندي بلدي - ربع تيس",         nameEn: "Local Lamb Mandi - Quarter Goat",     category: "meat",     price: 35000,  imageKey: "goat_mandi",         sortOrder: 3  },
  { itemId: "m4",   name: "لحم مندي - نفر",                  nameEn: "Lamb Mandi - Per Person",             category: "meat",     price: 9000,   imageKey: "meat_mandi_nfar",    sortOrder: 4  },
  { itemId: "h1",   name: "حنيذ بلدي - كامل",                nameEn: "Local Haneeth - Whole",               category: "meat",     price: 140000, imageKey: "goat_mandi",         sortOrder: 5  },
  { itemId: "h2",   name: "حنيذ بلدي - نفر",                 nameEn: "Local Haneeth - Per Person",          category: "meat",     price: 9000,   imageKey: "meat_mandi_nfar",    sortOrder: 6  },
  { itemId: "s1",   name: "إيدام ملوخية صغير",               nameEn: "Mulukhiyah Stew Small",               category: "sides",    price: 400,    imageKey: "molokhia",           sortOrder: 1  },
  { itemId: "s2",   name: "إيدام ملوخية كبير",               nameEn: "Mulukhiyah Stew Large",               category: "sides",    price: 600,    imageKey: "molokhia",           sortOrder: 2  },
  { itemId: "e6",   name: "إيدام مصقعة صغير",                nameEn: "Masoqa Stew Small",                   category: "sides",    price: 400,    imageKey: "masqaa",             sortOrder: 3  },
  { itemId: "e7",   name: "إيدام مصقعة كبير",                nameEn: "Masoqa Stew Large",                   category: "sides",    price: 600,    imageKey: "masqaa",             sortOrder: 4  },
  { itemId: "e4",   name: "باميه صغير",                      nameEn: "Okra Small",                          category: "sides",    price: 500,    imageKey: "bamya",              sortOrder: 5  },
  { itemId: "e5",   name: "باميه كبير",                      nameEn: "Okra Large",                          category: "sides",    price: 700,    imageKey: "bamya",              sortOrder: 6  },
  { itemId: "s5",   name: "إيدام فرن كبير",                  nameEn: "Oven Stew Large",                     category: "sides",    price: 600,    imageKey: null,                 sortOrder: 7  },
  { itemId: "sa1",  name: "سلطة خيار باللبن",                nameEn: "Cucumber Yogurt Salad",               category: "salads",   price: 300,    imageKey: "salad_laban",        sortOrder: 1  },
  { itemId: "sa2",  name: "سلطة خضراء",                      nameEn: "Green Salad",                         category: "salads",   price: 300,    imageKey: "salad_green",        sortOrder: 2  },
  { itemId: "sa3",  name: "طحينة سائلة",                     nameEn: "Tahini Sauce",                        category: "salads",   price: 300,    imageKey: "tahini",             sortOrder: 3  },
  { itemId: "d1",   name: "حلا أوريو",                       nameEn: "Oreo Dessert",                        category: "desserts", price: 400,    imageKey: "oreo_dessert",       sortOrder: 1  },
  { itemId: "d2",   name: "حلا تطلي",                        nameEn: "Tatli Dessert",                       category: "desserts", price: 400,    imageKey: "tatli",              sortOrder: 2  },
  { itemId: "d3",   name: "حلا مهلبية",                      nameEn: "Muhalabia",                           category: "desserts", price: 400,    imageKey: "muhalabia",          sortOrder: 3  },
  { itemId: "d4",   name: "كنافة قشطة",                      nameEn: "Kunafa with Cream",                   category: "desserts", price: 800,    imageKey: "kunafa",             sortOrder: 4  },
  { itemId: "dr1",  name: "بيبسي عائلي 2.25 لتر",           nameEn: "Pepsi Family 2.25L",                  category: "drinks",   price: 900,    imageKey: "pepsi_family",       sortOrder: 1  },
  { itemId: "dr2",  name: "بيبسي وسط 1 لتر",               nameEn: "Pepsi Medium 1L",                     category: "drinks",   price: 500,    imageKey: "pepsi",              sortOrder: 2  },
  { itemId: "dr3",  name: "بيبسي علبة",                     nameEn: "Pepsi Can",                           category: "drinks",   price: 250,    imageKey: "pepsi_can",          sortOrder: 3  },
  { itemId: "dr9",  name: "بيبسي دايت علبة",               nameEn: "Pepsi Diet Can",                      category: "drinks",   price: 250,    imageKey: "pepsi_diet_can",     sortOrder: 4  },
  { itemId: "dr5",  name: "ديو عائلي",                      nameEn: "Mountain Dew Family",                 category: "drinks",   price: 900,    imageKey: "dew",                sortOrder: 5  },
  { itemId: "dr6",  name: "ميرندا برتقال عائلي",            nameEn: "Mirinda Orange Family",               category: "drinks",   price: 900,    imageKey: "mirinda_orange",     sortOrder: 6  },
  { itemId: "dr7",  name: "ميرندا حمضيات عائلي",            nameEn: "Mirinda Citrus Family",               category: "drinks",   price: 900,    imageKey: "mirinda_citrus",     sortOrder: 7  },
  { itemId: "dr11", name: "ميرندا حمضيات علبة",             nameEn: "Mirinda Citrus Can",                  category: "drinks",   price: 250,    imageKey: "mirinda_citrus_can", sortOrder: 8  },
  { itemId: "dr8",  name: "سفن أب عائلي",                   nameEn: "7UP Family",                          category: "drinks",   price: 900,    imageKey: "sevenup",            sortOrder: 9  },
  { itemId: "dr10", name: "سفن أب فري علبة",                nameEn: "7UP Free Can",                        category: "drinks",   price: 250,    imageKey: "sevenup_can",        sortOrder: 10 },
  { itemId: "dr4",  name: "لبن المراعي علبة",               nameEn: "Almarai Laban Can",                   category: "drinks",   price: 250,    imageKey: "laban",              sortOrder: 11 },
  { itemId: "dr12", name: "لبن القرية حجم كبير",            nameEn: "Al-Qariah Laban Large",               category: "drinks",   price: 900,    imageKey: "laban_qariah_lg",    sortOrder: 12 },
  { itemId: "dr13", name: "لبن القرية حجم صغير",            nameEn: "Al-Qariah Laban Small",               category: "drinks",   price: 300,    imageKey: "laban_qariah_sm",    sortOrder: 13 },
  { itemId: "dr14", name: "لبن المراعي 2 لتر",              nameEn: "Almarai Laban 2L",                    category: "drinks",   price: 1100,   imageKey: "laban_almarai_lg",   sortOrder: 14 },
  { itemId: "dr15", name: "لبن المراعي 1 لتر",              nameEn: "Almarai Laban 1L",                    category: "drinks",   price: 600,    imageKey: "laban_almarai_1l",   sortOrder: 15 },
  { itemId: "e2",   name: "قرصان صغير",                     nameEn: "Qursan Small",                        category: "extras",   price: 400,    imageKey: "qursan",             sortOrder: 1  },
  { itemId: "e3",   name: "قرصان كبير",                     nameEn: "Qursan Large",                        category: "extras",   price: 600,    imageKey: "qursan",             sortOrder: 2  },
  { itemId: "e11",  name: "جريش صغير",                      nameEn: "Jareesh Small",                       category: "extras",   price: 400,    imageKey: "jareesh",            sortOrder: 3  },
  { itemId: "e12",  name: "جريش كبير",                      nameEn: "Jareesh Large",                       category: "extras",   price: 600,    imageKey: "jareesh",            sortOrder: 4  },
  { itemId: "e8",   name: "سلطة خيار باللبن",               nameEn: "Cucumber Yogurt Salad",               category: "extras",   price: 300,    imageKey: "salad_laban",        sortOrder: 5  },
  { itemId: "e9",   name: "سلطة خضراء",                     nameEn: "Green Salad",                         category: "extras",   price: 300,    imageKey: "salad_green",        sortOrder: 6  },
  { itemId: "e10",  name: "طحينية سائلة",                   nameEn: "Tahini Sauce",                        category: "extras",   price: 300,    imageKey: "tahini",             sortOrder: 7  },
];

export async function seedMenu() {
  // Only seed when the table is completely empty (first-time setup).
  // This prevents re-inserting items that were intentionally deleted from the dashboard.
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(menuItemsTable);
  if (countRow && Number(countRow.count) > 0) {
    return; // Table already has data — skip seeding entirely
  }
  for (const item of INITIAL_ITEMS) {
    await db
      .insert(menuItemsTable)
      .values({ ...item, available: true })
      .onConflictDoNothing();
  }
}

const sizeOptionSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
  enabled: z.boolean(),
});

const optionChoiceSchema = z.object({
  name: z.string().min(1),
  extraPrice: z.number().min(0),
  available: z.boolean(),
});

const simpleChoiceSchema = z.object({
  name: z.string().min(1),
  extraPrice: z.number().min(0),
  available: z.boolean(),
});

const optionGroupSchema = z.object({
  groupName: z.string().min(1),
  required: z.boolean(),
  choices: z.array(optionChoiceSchema),
});

const createSchema = z.object({
  name: z.string().min(1),
  nameEn: z.string().optional(),
  category: z.string().min(1),
  price: z.number().positive(),
  imageKey: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  stock: z.number().int().min(0).nullable().optional(),
  sizes: z.array(sizeOptionSchema).optional(),
  options: z.array(optionGroupSchema).optional(),
  riceTypes: z.array(simpleChoiceSchema).optional(),
  additions: z.array(simpleChoiceSchema).optional(),
  calories: z.number().int().min(0).nullable().optional(),
  walkingMinutes: z.number().int().min(0).nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  nameEn: z.string().optional(),
  category: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  available: z.boolean().optional(),
  imageKey: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  stock: z.number().int().min(0).nullable().optional(),
  sizes: z.array(sizeOptionSchema).optional(),
  options: z.array(optionGroupSchema).optional(),
  riceTypes: z.array(simpleChoiceSchema).optional(),
  additions: z.array(simpleChoiceSchema).optional(),
  calories: z.number().int().min(0).nullable().optional(),
  walkingMinutes: z.number().int().min(0).nullable().optional(),
});

const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().max(80).optional(),
  icon: z.string().trim().min(1).max(24).optional(),
  imageUrl: z.string().url().nullable().optional(),
  isVisible: z.boolean().optional(),
});

const categoryUpdateSchema = categoryCreateSchema.partial();
const categoryOrderSchema = z.object({
  categoryIds: z.array(z.string().min(1)).min(1),
});
const categoryDeleteSchema = z.object({
  moveProductsTo: z.string().min(1).optional(),
});

async function ensureCategoryExists(categoryId: string): Promise<boolean> {
  return (await getCategories()).some((category) => category.id === categoryId);
}

router.get("/menu", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const items = await db
    .select()
    .from(menuItemsTable)
    .orderBy(asc(menuItemsTable.category), asc(menuItemsTable.sortOrder));
  res.json(items);
});

router.get("/menu/categories", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(await getCategories());
});

router.post("/menu/categories", requireSameOriginDashboardRequest, requireDashboardAdmin, async (req, res) => {
  const parsed = categoryCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات القسم غير صحيحة", details: parsed.error.issues });
    return;
  }

  const categories = await getCategories();
  const data = parsed.data;
  const category: MenuCategory = {
    id: `category_${randomUUID().replaceAll("-", "")}`,
    name: data.name,
    nameEn: data.nameEn || data.name,
    icon: data.icon || "🍽️",
    imageUrl: data.imageUrl ?? null,
    isVisible: data.isVisible ?? true,
    sortOrder: categories.length,
  };
  await saveCategories([...categories, category]);
  res.status(201).json(category);
});

router.put("/menu/categories/order", requireSameOriginDashboardRequest, requireDashboardAdmin, async (req, res) => {
  const parsed = categoryOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ترتيب الأقسام غير صحيح", details: parsed.error.issues });
    return;
  }

  const categories = await getCategories();
  const knownIds = new Set(categories.map((category) => category.id));
  const requestedIds = parsed.data.categoryIds;
  if (new Set(requestedIds).size !== requestedIds.length || requestedIds.length !== categories.length || requestedIds.some((id) => !knownIds.has(id))) {
    res.status(400).json({ error: "يجب إرسال جميع الأقسام مرة واحدة دون تكرار" });
    return;
  }

  const sortOrderById = new Map(requestedIds.map((id, index) => [id, index]));
  const updated = categories.map((category) => ({ ...category, sortOrder: sortOrderById.get(category.id)! }));
  await saveCategories(updated);
  res.json(orderCategories(updated));
});

router.put("/menu/categories/:categoryId", requireSameOriginDashboardRequest, requireDashboardAdmin, async (req, res) => {
  const parsed = categoryUpdateSchema.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    res.status(400).json({ error: "بيانات القسم غير صحيحة", details: parsed.success ? undefined : parsed.error.issues });
    return;
  }

  const categories = await getCategories();
  const categoryIndex = categories.findIndex((category) => category.id === req.params.categoryId);
  if (categoryIndex === -1) {
    res.status(404).json({ error: "القسم غير موجود" });
    return;
  }

  const data = parsed.data;
  const current = categories[categoryIndex];
  const updated: MenuCategory = {
    ...current,
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.nameEn !== undefined ? { nameEn: data.name || current.nameEn } : {}),
    ...(data.icon !== undefined ? { icon: data.icon || "🍽️" } : {}),
    ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
    ...(data.isVisible !== undefined ? { isVisible: data.isVisible } : {}),
  };
  if (data.name !== undefined && data.nameEn === undefined && current.nameEn === current.name) {
    updated.nameEn = data.name;
  }
  categories[categoryIndex] = updated;
  await saveCategories(categories);
  res.json(updated);
});

router.delete("/menu/categories/:categoryId", requireSameOriginDashboardRequest, requireDashboardAdmin, async (req, res) => {
  const parsed = categoryDeleteSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات الحذف غير صحيحة", details: parsed.error.issues });
    return;
  }

  const categoryId = req.params.categoryId;
  if (typeof categoryId !== "string") {
    res.status(400).json({ error: "معرّف القسم غير صحيح" });
    return;
  }

  const categories = await getCategories();
  const category = categories.find((item) => item.id === categoryId);
  if (!category) {
    res.status(404).json({ error: "القسم غير موجود" });
    return;
  }

  const targetCategoryId = parsed.data.moveProductsTo;
  const remaining = categories
    .filter((item) => item.id !== categoryId)
    .map((item, sortOrder) => ({ ...item, sortOrder }));

  try {
    const movedProducts = await db.transaction(async (tx) => {
      const products = await tx
        .select({ itemId: menuItemsTable.itemId })
        .from(menuItemsTable)
        .where(eq(menuItemsTable.category, categoryId));
      if (products.length > 0) {
        if (!targetCategoryId || targetCategoryId === categoryId || !categories.some((item) => item.id === targetCategoryId)) {
          throw new Error("CATEGORY_MOVE_TARGET_REQUIRED");
        }
        await tx
          .update(menuItemsTable)
          .set({ category: targetCategoryId })
          .where(eq(menuItemsTable.category, categoryId));
      }
      await tx
        .insert(appSettingsTable)
        .values({ key: CATEGORY_SETTINGS_KEY, value: JSON.stringify(orderCategories(remaining)) })
        .onConflictDoUpdate({
          target: appSettingsTable.key,
          set: { value: JSON.stringify(orderCategories(remaining)), updatedAt: new Date() },
        });
      return products.length;
    });
    res.json({ success: true, movedProducts, categories: remaining });
  } catch (error) {
    if (error instanceof Error && error.message === "CATEGORY_MOVE_TARGET_REQUIRED") {
      res.status(400).json({ error: "اختر قسمًا آخر لنقل المنتجات إليه قبل الحذف" });
      return;
    }
    throw error;
  }
});

router.post("/menu", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;
  if (!await ensureCategoryExists(data.category)) {
    res.status(400).json({ error: "القسم المحدد غير موجود" });
    return;
  }
  const [item] = await db.insert(menuItemsTable).values({
    itemId: randomUUID(),
    name: data.name,
    nameEn: data.nameEn ?? null,
    category: data.category,
    price: Math.round(data.price * 100),
    available: true,
    imageKey: data.imageKey ?? null,
    imageUrl: data.imageUrl ?? null,
    sizes: (data.sizes ?? []).map(s => ({ ...s, price: Math.round(s.price * 100) })),
    options: (data.options ?? []).map(g => ({
      ...g,
      choices: g.choices.map(c => ({ ...c, extraPrice: Math.round(c.extraPrice * 100) })),
    })),
    riceTypes: (data.riceTypes ?? []).map(r => ({ ...r, extraPrice: Math.round(r.extraPrice * 100) })),
    additions: (data.additions ?? []).map(a => ({ ...a, extraPrice: Math.round(a.extraPrice * 100) })),
    calories: data.calories ?? null,
    walkingMinutes: data.walkingMinutes ?? null,
    sortOrder: 999,
  }).returning();
  req.log.info({ itemId: item.itemId }, "Menu item created");
  res.status(201).json(item);
});

router.put("/menu/:itemId", async (req, res) => {
  const { itemId } = req.params;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;
  if (data.category !== undefined && !await ensureCategoryExists(data.category)) {
    res.status(400).json({ error: "القسم المحدد غير موجود" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.nameEn !== undefined) updates.nameEn = data.nameEn;
  if (data.category !== undefined) updates.category = data.category;
  if (data.price !== undefined) updates.price = Math.round(data.price * 100);
  if (data.available !== undefined) updates.available = data.available;
  if (data.imageKey !== undefined) updates.imageKey = data.imageKey;
  if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl;
  if (data.sizes !== undefined) updates.sizes = data.sizes.map(s => ({ ...s, price: Math.round(s.price * 100) }));
  if (data.options !== undefined) updates.options = data.options.map(g => ({
    ...g,
    choices: g.choices.map(c => ({ ...c, extraPrice: Math.round(c.extraPrice * 100) })),
  }));
  if (data.riceTypes !== undefined) updates.riceTypes = data.riceTypes.map(r => ({ ...r, extraPrice: Math.round(r.extraPrice * 100) }));
  if (data.additions !== undefined) updates.additions = data.additions.map(a => ({ ...a, extraPrice: Math.round(a.extraPrice * 100) }));
  if (data.calories !== undefined) updates.calories = data.calories;
  if (data.walkingMinutes !== undefined) updates.walkingMinutes = data.walkingMinutes;
  if (data.stock !== undefined) {
    updates.stock = data.stock;
    if (data.stock === null) updates.available = true;
    else if (data.stock === 0) updates.available = false;
    else if (data.stock > 0) updates.available = true;
  }

  const [item] = await db
    .update(menuItemsTable)
    .set(updates)
    .where(eq(menuItemsTable.itemId, itemId))
    .returning();

  if (!item) {
    res.status(404).json({ error: "الصنف غير موجود" });
    return;
  }
  res.json(item);
});

router.delete("/menu/:itemId", async (req, res) => {
  const { itemId } = req.params;
  const [item] = await db
    .delete(menuItemsTable)
    .where(eq(menuItemsTable.itemId, itemId))
    .returning();
  if (!item) {
    res.status(404).json({ error: "الصنف غير موجود" });
    return;
  }
  res.json({ success: true });
});

// DELETE /menu/:itemId/image — delete uploaded image from storage and clear DB reference
router.delete("/menu/:itemId/image", async (req, res) => {
  const { itemId } = req.params;
  const [item] = await db
    .select()
    .from(menuItemsTable)
    .where(eq(menuItemsTable.itemId, itemId));

  if (!item) {
    res.status(404).json({ error: "الصنف غير موجود" });
    return;
  }

  if (item.imageUrl) {
    try {
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(item.imageUrl);
      if (normalizedPath.startsWith("/objects/")) {
        const file = await objectStorageService.getObjectEntityFile(normalizedPath);
        await file.delete();
        req.log.info({ itemId, normalizedPath }, "Menu item image deleted from storage");
      }
    } catch (err) {
      req.log.warn({ err, itemId }, "Could not delete image from storage — clearing DB reference anyway");
    }
  }

  await db
    .update(menuItemsTable)
    .set({ imageUrl: null, imageKey: null })
    .where(eq(menuItemsTable.itemId, itemId));

  res.json({ success: true });
});

export default router;
