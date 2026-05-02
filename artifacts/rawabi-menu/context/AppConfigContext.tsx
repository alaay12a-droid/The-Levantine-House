import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@rawabi_app_config_v1";

export interface AppConfig {
  cardPadding: number;
  sectionGap: number;
  itemPaddingV: number;
  borderRadius: number;
  horizontalMargin: number;
  imageSize: number;

  titleSize: number;
  bodySize: number;
  captionSize: number;
  priceSize: number;

  tabHeight: number;
  tabPaddingBottom: number;
  tabFontSize: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  cardPadding: 16,
  sectionGap: 12,
  itemPaddingV: 14,
  borderRadius: 14,
  horizontalMargin: 16,
  imageSize: 80,

  titleSize: 20,
  bodySize: 15,
  captionSize: 12,
  priceSize: 16,

  tabHeight: 70,
  tabPaddingBottom: 10,
  tabFontSize: 12,
};

interface AppConfigContextValue {
  config: AppConfig;
  loaded: boolean;
  update: (partial: Partial<AppConfig>) => Promise<void>;
  reset: () => Promise<void>;
}

const AppConfigContext = createContext<AppConfigContextValue>({
  config: DEFAULT_CONFIG,
  loaded: false,
  update: async () => {},
  reset: async () => {},
});

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const saved = JSON.parse(raw);
          setConfig({ ...DEFAULT_CONFIG, ...saved });
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback(async (partial: Partial<AppConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const reset = useCallback(async () => {
    setConfig(DEFAULT_CONFIG);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return (
    <AppConfigContext.Provider value={{ config, loaded, update, reset }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  return useContext(AppConfigContext);
}
