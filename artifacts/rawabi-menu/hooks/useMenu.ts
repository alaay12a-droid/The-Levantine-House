import { useState, useEffect, useCallback } from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet } from "@/constants/api";
import { MENU_CATEGORIES, FOOD_IMAGES, type MenuItem } from "@/constants/menu";

// v3: shorter TTL so image replacements propagate faster
const MENU_CACHE_KEY = "@rawabi_menu_cache_v3";
const MENU_CACHE_TTL_MS = 90 * 1000; // 90 seconds — catches image updates quickly

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

  // On mount: load cached data (only if still fresh) then always fetch from server
  useEffect(() => {
    AsyncStorage.getItem(MENU_CACHE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed: MenuCache = JSON.parse(raw);
          const isFresh = Date.now() - parsed.savedAt < MENU_CACHE_TTL_MS;
          if (isFresh && Array.isArray(parsed.items) && parsed.items.length > 0) {
            setCategories(buildCategories(parsed.items));
            setApiItems(parsed.items);
          } else {
            // Cache expired — show static fallback until fresh fetch completes
            setCategories(staticFallback());
          }
        } catch {
          setCategories(staticFallback());
        }
      } else {
        setCategories(staticFallback());
      }
    }).catch(() => {
      setCategories(staticFallback());
    });
  }, []);

  const fetch = useCallback(async () => {
    try {
      const data = await apiGet<ApiMenuItem[]>("/menu");
      setApiItems(data);
      setCategories(buildCategories(data));
      const cache: MenuCache = { items: data, savedAt: Date.now() };
      AsyncStorage.setItem(MENU_CACHE_KEY, JSON.stringify(cache)).catch(() => {});
    } catch {
      // fallback to cached/static data (already set)
    } finally {
      setLoading(false);
    }
  }, []);

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
