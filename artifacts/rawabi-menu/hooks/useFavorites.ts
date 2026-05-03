import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@rawabi_favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      setFavorites(raw ? JSON.parse(raw) : []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const isFavorite = (itemId: string) => favorites.includes(itemId);

  const toggleFavorite = async (itemId: string) => {
    const updated = favorites.includes(itemId)
      ? favorites.filter((id) => id !== itemId)
      : [...favorites, itemId];
    setFavorites(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  return { favorites, isFavorite, toggleFavorite };
}
