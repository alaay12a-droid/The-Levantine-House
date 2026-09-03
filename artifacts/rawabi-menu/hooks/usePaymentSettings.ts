import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppConfig } from "@/context/AppConfigContext";

const LOCAL_KEY = "@thelevantinehouse_payment_local";

export interface PaymentSettings {
  applePayEnabled: boolean;
  moyasarPublishableKey: string;
  moyasarApplePayIdentifier: string;
  deliveryFee: number;
  deliveryEnabled: boolean;
  freeDeliveryThreshold: number;
}

const LOCAL_DEFAULTS = {
  applePayEnabled: false,
  moyasarPublishableKey: "",
  moyasarApplePayIdentifier: "",
};

export function usePaymentSettings() {
  const { config, loaded: configLoaded } = useAppConfig();
  const [local, setLocal] = useState(LOCAL_DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(LOCAL_KEY).then((raw) => {
      if (raw) {
        try { setLocal({ ...LOCAL_DEFAULTS, ...JSON.parse(raw) }); } catch {}
      }
    });
  }, []);

  const settings: PaymentSettings = {
    ...local,
    deliveryFee: config.deliveryFee,
    deliveryEnabled: config.deliveryEnabled,
    freeDeliveryThreshold: config.freeDeliveryThreshold,
  };

  const saveSettings = useCallback(async (updated: PaymentSettings) => {
    const localPart = {
      applePayEnabled: updated.applePayEnabled,
      moyasarPublishableKey: updated.moyasarPublishableKey,
      moyasarApplePayIdentifier: updated.moyasarApplePayIdentifier,
    };
    setLocal(localPart);
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(localPart));
  }, []);

  return { settings, saveSettings, loaded: configLoaded };
}
