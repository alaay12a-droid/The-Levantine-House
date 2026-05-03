import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet } from "@/constants/api";

const STORAGE_KEY = "@rawabi_favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);

  const load = useCallback(async () => {
    try {
      const [raw, setting] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        apiGet<{ enabled: boolean }>("/settings/favorites-enabled").catch(() => ({ enabled: true })),
      ]);
      setFavorites(raw ? JSON.parse(raw) : []);
      setEnabled(setting.enabled);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const isFavorite = (itemId: string) => enabled && favorites.includes(itemId);

  const toggleFavorite = async (itemId: string) => {
    if (!enabled) return;
    const updated = favorites.includes(itemId)
      ? favorites.filter((id) => id !== itemId)
      : [...favorites, itemId];
    setFavorites(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  return { favorites: enabled ? favorites : [], isFavorite, toggleFavorite, enabled };
}
