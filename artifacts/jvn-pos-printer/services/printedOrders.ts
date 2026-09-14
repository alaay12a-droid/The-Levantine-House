import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@levantine-house/printer/printed-orders-v1';
const MAX_SAVED_IDS = 1000;

export async function loadPrintedOrderIds(): Promise<Set<number>> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return new Set();

  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) return new Set();
  return new Set(parsed.filter((id): id is number => Number.isInteger(id)));
}

export async function savePrintedOrderId(
  printedIds: Set<number>,
  orderId: number,
): Promise<Set<number>> {
  const next = new Set(printedIds);
  next.add(orderId);
  const trimmed = [...next].slice(-MAX_SAVED_IDS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return new Set(trimmed);
}