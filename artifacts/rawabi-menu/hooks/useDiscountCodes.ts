import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/constants/api";

export interface DiscountCode {
  id: number;
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
      const data = await apiGet<DiscountCode[]>("/discount-codes");
      setCodes(data);
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addCode = async (input: Omit<DiscountCode, "id">) => {
    const created = await apiPost<DiscountCode>("/discount-codes", input);
    setCodes((prev) => [...prev, created]);
  };

  const updateCode = async (id: number, changes: Partial<DiscountCode>) => {
    const updated = await apiPatch<DiscountCode>(`/discount-codes/${id}`, changes);
    setCodes((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const deleteCode = async (id: number) => {
    await apiDelete(`/discount-codes/${id}`);
    setCodes((prev) => prev.filter((c) => c.id !== id));
  };

  const activeCodes = codes.filter((c) => c.active);

  return { codes, activeCodes, loaded, load, addCode, updateCode, deleteCode };
}
