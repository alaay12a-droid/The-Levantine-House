import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@rawabi_payment_settings";

export interface PaymentSettings {
  applePayEnabled: boolean;
  moyasarPublishableKey: string;
  moyasarApplePayIdentifier: string;
}

const DEFAULT_SETTINGS: PaymentSettings = {
  applePayEnabled: false,
  moyasarPublishableKey: "",
  moyasarApplePayIdentifier: "",
};

export function usePaymentSettings() {
  const [settings, setSettings] = useState<PaymentSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const saveSettings = useCallback(async (updated: PaymentSettings) => {
    setSettings(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  return { settings, saveSettings, loaded };
}
