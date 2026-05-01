import { useState, useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const TOKEN_KEY = "@rawabi_customer_push_token";

// Show notifications even when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerCustomerNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  // Request permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  // Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("order-status", {
      name: "حالة طلبك",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 200, 100, 200],
      lightColor: "#D4AF37",
      showBadge: true,
    });
  }

  // Return cached token or fetch new one
  try {
    const cached = await AsyncStorage.getItem(TOKEN_KEY);
    if (cached) return cached;

    const { data } = await Notifications.getExpoPushTokenAsync();
    await AsyncStorage.setItem(TOKEN_KEY, data);
    return data;
  } catch {
    return null;
  }
}

export function useCustomerPushToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Try to load cached token first (fast path, no permission re-prompt)
    AsyncStorage.getItem(TOKEN_KEY).then((cached) => {
      if (cached) {
        setToken(cached);
      } else {
        registerCustomerNotifications().then(setToken);
      }
    });
  }, []);

  return token;
}
