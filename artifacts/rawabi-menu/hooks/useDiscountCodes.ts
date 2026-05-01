import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const STORAGE_KEY = "@rawabi_discount_codes";

export interface DiscountCode {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  minOrder: number;
  description: string;
  active: boolean;
}

export function useDiscountCodes() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      setCodes(raw ? JSON.parse(raw) : []);
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = async (updated: DiscountCode[]) => {
    setCodes(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const addCode = async (input: Omit<DiscountCode, "id">) => {
    const newCode: DiscountCode = { ...input, id: genId() };
    await persist([...codes, newCode]);
  };

  const updateCode = async (id: string, changes: Partial<DiscountCode>) => {
    await persist(codes.map((c) => (c.id === id ? { ...c, ...changes } : c)));
  };

  const deleteCode = async (id: string) => {
    await persist(codes.filter((c) => c.id !== id));
  };

  const activeCodes = codes.filter((c) => c.active);

  return { codes, activeCodes, loaded, addCode, updateCode, deleteCode };
}
