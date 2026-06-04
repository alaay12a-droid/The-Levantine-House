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
  expiresAt: string | null;
  usageCount: number;
}

export interface DiscountCodeUsage {
  id: number;
  phone: string;
  orderId: number | null;
  usedAt: string;
  orderTotal: number | null;
  discountAmount: number | null;
}

export interface DiscountCodeUsages {
  usages: DiscountCodeUsage[];
  totalSavings: number;
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

  const addCode = async (input: Omit<DiscountCode, "id" | "usageCount">) => {
    const created = await apiPost<DiscountCode>("/discount-codes", input);
    setCodes((prev) => [...prev, { ...created, usageCount: created.usageCount ?? 0 }]);
  };

  const updateCode = async (id: number, changes: Partial<DiscountCode>) => {
    const updated = await apiPatch<DiscountCode>(`/discount-codes/${id}`, changes);
    setCodes((prev) => prev.map((c) => (c.id === id ? { ...updated, usageCount: c.usageCount } : c)));
  };

  const deleteCode = async (id: number) => {
    await apiDelete(`/discount-codes/${id}`);
    setCodes((prev) => prev.filter((c) => c.id !== id));
  };

  const fetchUsages = async (id: number): Promise<DiscountCodeUsages> => {
    return await apiGet<DiscountCodeUsages>(`/discount-codes/${id}/usages`);
  };

  const activeCodes = codes.filter((c) => c.active);

  return { codes, activeCodes, loaded, load, addCode, updateCode, deleteCode, fetchUsages };
}
