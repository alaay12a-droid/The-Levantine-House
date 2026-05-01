import { useState, useCallback } from "react";
import { apiGet } from "@/constants/api";

export interface RevenuePeriod {
  totalRevenue: number;
  deliveryRevenue: number;
  itemsRevenue: number;
  orderCount: number;
}

export interface DailyPoint {
  date: string;
  total: number;
  delivery: number;
  items: number;
  orders: number;
}

export interface MonthlyPoint {
  month: string;
  total: number;
  delivery: number;
  items: number;
  orders: number;
}

export interface RevenueData {
  today: RevenuePeriod;
  month: RevenuePeriod;
  year: RevenuePeriod;
  dailyBreakdown: DailyPoint[];
  monthlyBreakdown: MonthlyPoint[];
}

export function useRevenue() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await apiGet<RevenueData>("/revenue");
      setData(result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, refresh };
}
