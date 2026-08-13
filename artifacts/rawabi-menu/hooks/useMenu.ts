import { useState, useEffect, useCallback } from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet } from "@/constants/api";
import { MENU_CATEGORIES, FOOD_IMAGES, type MenuItem } from "@/constants/menu";

const MENU_CACHE_KEY = "@rawabi_menu_cache_v3";
const MENU_CACHE_TTL_MS = 90 * 1000; // 90 seconds

interface MenuCache {
  items: ApiMenuItem[];
  savedAt: number;
}

export interface ApiMenuItemSize {
  name: string;
  price: number;
  enabled: boolean;
}

export interface ApiMenuItemOptionChoice {
  name: string;
  extraPrice: number;
  available: boolean;
}

export interface ApiMenuItemOptionGroup {
  groupName: string;
  required: boolean;
  choices: ApiMenuItemOptionChoice[];
}

export interface ApiMenuItemSimpleChoice {
  name: string;
  extraPrice: number;
  available: boolean;
}

export interface ApiMenuItem {
  id: number;
  itemId: string;
  name: string;
  nameEn: string | null;
  category: string;
  price: number;
  available: boolean;
  imageKey: string | null;
  imageUrl: string | null;
  stock: number | null;
  sizes: ApiMenuItemSize[];
  options: ApiMenuItemOptionGroup[];
  riceTypes: ApiMenuItemSimpleChoice[];
  additions: ApiMenuItemSimpleChoice[];
  calories: number | null;
  walkingMinutes: number | null;
  sortOrder: number;
  createdAt: string;
}

export interface MenuCategoryWithApi {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  isDelivery?: boolean;
  isDhabiha?: boolean;
  isOccasions?: boolean;
  items: (MenuItem & { available: boolean; nameEn?: string; stock?: number | null })[];
}

const CATEGORY_META: Record<string, { name: string; nameEn: string; icon: string; isDelivery?: boolean; isDhabiha?: boolean; isOccasions?: boolean }> = {
  chicken:  { name: "الدجاج",              nameEn: "Chicken",        icon: "🍗" },
  meat:     { name: "اللحوم",              nameEn: "Meat",           icon: "🥩" },
  mains:    { name: "الأطباق الرئيسية",    nameEn: "Main Dishes",    icon: "🍽️" },
  sides:    { name: "الإيدامات",           nameEn: "Sides",          icon: "🥘" },
  salads:   { name: "السلطات",             nameEn: "Salads",         icon: "🥗" },
  desserts: { name: "الحلويات",            nameEn: "Desserts",       icon: "🍮" },
  drinks:   { name: "المشروبات",           nameEn: "Drinks",         icon: "🥤" },
  extras:   { name: "إضافات",              nameEn: "Extras",         icon: "✨" },
};

function buildCategories(apiItems: ApiMenuItem[]): MenuCategoryWithApi[] {
  const categoryMap = new Map<string, (MenuItem & { available: boolean; nameEn?: string })[]>();

  for (const item of apiItems) {
    const existing = categoryMap.get(item.category) ?? [];
    existing.push({
      id: item.itemId,
      name: item.name,
      nameEn: item.nameEn ?? undefined,
      price: item.price / 100,
      category: item.category,
      imageKey: item.imageKey ?? undefined,
      imageUrl: item.imageUrl ?? undefined,
      available: item.available,
      stock: item.stock,
      sizes: (item.sizes ?? []).map(s => ({ ...s, price: s.price / 100 })),
      options: (item.options ?? []).map(g => ({
        ...g,
        choices: g.choices.map(c => ({ ...c, extraPrice: c.extraPrice / 100 })),
      })),
      riceTypes: (item.riceTypes ?? []).map(r => ({ ...r, extraPrice: r.extraPrice / 100 })),
      additions: (item.additions ?? []).map(a => ({ ...a, extraPrice: a.extraPrice / 100 })),
      calories: item.calories ?? undefined,
      walkingMinutes: item.walkingMinutes ?? undefined,
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
  ).map((c) => ({
    ...c,
    nameEn: c.nameEn ?? c.name,
    items: c.items.map((i) => ({ ...i, available: true })),
  })) as MenuCategoryWithApi[];

  return [...result, ...staticSpecial];
}

const staticFallback = (): MenuCategoryWithApi[] =>
  MENU_CATEGORIES.map((c) => ({
    ...c,
    nameEn: c.nameEn ?? c.name,
    items: c.items.map((i) => ({ ...i, available: true })),
  })) as MenuCategoryWithApi[];

export function useMenu() {
  const [categories, setCategories] = useState<MenuCategoryWithApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiItems, setApiItems] = useState<ApiMenuItem[]>([]);

  // Fetch fresh data from the server and update the cache.
  // NOTE: We intentionally do NOT pre-populate categories from the cache on
  // initial mount.  Showing cached (potentially stale) data first causes
  // deleted items to flash briefly before the server response arrives.
  // loading=true is held until this fetch settles, so the UI shows a
  // skeleton instead of stale content.
  const fetch = useCallback(async () => {
    try {
      const data = await apiGet<ApiMenuItem[]>("/menu");
      setApiItems(data);
      setCategories(buildCategories(data));
      const cache: MenuCache = { items: data, savedAt: Date.now() };
      AsyncStorage.setItem(MENU_CACHE_KEY, JSON.stringify(cache)).catch(() => {});
    } catch {
      // Network failed — fall back to static bundle so the menu is never blank
      setCategories((prev) => (prev.length > 0 ? prev : staticFallback()));
    } finally {
      setLoading(false);
    }
  }, []);

  // refreshIfStale is used by tab-focus and app-foreground listeners.
  // It DOES use the cache TTL: if the user just fetched data a few seconds
  // ago there is no need to hit the server again.
  const refreshIfStale = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(MENU_CACHE_KEY);
      if (!raw) { await fetch(); return; }
      const { savedAt } = JSON.parse(raw) as MenuCache;
      if (Date.now() - savedAt > MENU_CACHE_TTL_MS) await fetch();
    } catch {
      await fetch();
    }
  }, [fetch]);

  // Always fetch on mount — never show cached data as the first render
  useEffect(() => {
    fetch();
  }, [fetch]);

  // Silently refresh when the app comes back to the foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") refreshIfStale();
    });
    return () => sub.remove();
  }, [refreshIfStale]);

  return { categories, loading, refresh: fetch, refreshIfStale, apiItems, FOOD_IMAGES };
}
