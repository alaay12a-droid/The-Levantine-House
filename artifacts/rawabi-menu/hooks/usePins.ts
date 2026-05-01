import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@rawabi_pins";
const MASTER_CODE = "RAWABI@2026";

export interface Pins {
  cashier: string;
  admin: string;
}

const DEFAULTS: Pins = {
  cashier: "Aa@000",
  admin: "Aa@000",
};

export async function loadPins(): Promise<Pins> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

export async function savePins(pins: Pins): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(pins));
}

export function isMasterCode(code: string): boolean {
  return code === MASTER_CODE;
}
