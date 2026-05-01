import { useState, useEffect, useCallback } from "react";
import { apiGet } from "@/constants/api";
import { MENU_CATEGORIES, FOOD_IMAGES, type MenuItem } from "@/constants/menu";

export interface ApiMenuItem {
  id: number;
  itemId: string;
  name: string;
  category: string;
  price: number;
  available: boolean;
  imageKey: string | null;
  imageUrl: string | null;
  stock: number | null;
  sortOrder: number;
  createdAt: string;
}

export interface MenuCategoryWithApi {
  id: string;
  name: string;
  icon: string;
  isDelivery?: boolean;
  isDhabiha?: boolean;
  isOccasions?: boolean;
  items: (MenuItem & { available: boolean })[];
}

const CATEGORY_META: Record<string, { name: string; icon: string; isDelivery?: boolean; isDhabiha?: boolean; isOccasions?: boolean }> = {
  chicken:  { name: "الدجاج",              icon: "🍗" },
  meat:     { name: "اللحوم",              icon: "🥩" },
  mains:    { name: "الأطباق الرئيسية",    icon: "🍽️" },
  sides:    { name: "الإيدامات",           icon: "🥘" },
  salads:   { name: "السلطات",             icon: "🥗" },
  desserts: { name: "الحلويات",            icon: "🍮" },
  drinks:   { name: "المشروبات",           icon: "🥤" },
  extras:   { name: "إضافات",              icon: "✨" },
};

function buildCategories(apiItems: ApiMenuItem[]): MenuCategoryWithApi[] {
  const categoryMap = new Map<string, (MenuItem & { available: boolean })[]>();

  for (const item of apiItems) {
    const existing = categoryMap.get(item.category) ?? [];
    existing.push({
      id: item.itemId,
      name: item.name,
      price: item.price / 100,
      category: item.category,
      imageKey: item.imageKey ?? undefined,
      imageUrl: item.imageUrl ?? undefined,
      available: item.available,
    });
    categoryMap.set(item.category, existing);
  }

  const result: MenuCategoryWithApi[] = [];

  for (const [catId, items] of categoryMap.entries()) {
    const meta = CATEGORY_META[catId];
    if (meta) {
      result.push({ id: catId, ...meta, items });
    }
  }

  const order = ["chicken", "meat", "mains", "sides", "salads", "desserts", "drinks", "extras"];
  result.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  const staticSpecial = MENU_CATEGORIES.filter(
    (c) => c.isDelivery || c.isDhabiha || c.isOccasions
  ) as MenuCategoryWithApi[];

  return [...result, ...staticSpecial];
}

export function useMenu() {
  const [categories, setCategories] = useState<MenuCategoryWithApi[]>(() => {
    return MENU_CATEGORIES.map((c) => ({
      ...c,
      items: c.items.map((i) => ({ ...i, available: true })),
    })) as MenuCategoryWithApi[];
  });
  const [loading, setLoading] = useState(true);
  const [apiItems, setApiItems] = useState<ApiMenuItem[]>([]);

  const fetch = useCallback(async () => {
    try {
      const data = await apiGet<ApiMenuItem[]>("/menu");
      setApiItems(data);
      setCategories(buildCategories(data));
    } catch {
      // fallback to static data (already set)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { categories, loading, refresh: fetch, apiItems, FOOD_IMAGES };
}
