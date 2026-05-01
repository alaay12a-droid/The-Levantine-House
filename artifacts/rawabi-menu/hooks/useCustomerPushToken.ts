import { useState, useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "@rawabi_customer_push_token";

async function setupCustomerNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

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
    setupCustomerNotifications().then(setToken);
  }, []);

  return token;
}
