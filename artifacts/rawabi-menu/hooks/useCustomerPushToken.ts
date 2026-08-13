import { useState, useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiPost } from "@/constants/api";

export const TOKEN_KEY = "@rawabi_customer_push_token";

const PROJECT_ID = "75492716-d1d5-4871-bfd9-18c7ef3982c7";

// Must be wrapped in try/catch — throws in Expo Go and some emulators
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Not supported in this environment — safe to ignore
}

export async function registerCustomerNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
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

    // Get Expo push token (used as stable key per device)
    const { data: expoToken } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    await AsyncStorage.setItem(TOKEN_KEY, expoToken);

    // Get native FCM token for direct Firebase Admin SDK delivery.
    // iOS: skip this — without GoogleService-Info.plist, getDevicePushTokenAsync()
    // returns a raw APNs device token (not an FCM token). Sending that to Firebase
    // triggers invalid-registration-token errors. Expo Push API handles iOS natively.
    let fcmToken: string | null = null;
    if (Platform.OS === "android") {
      try {
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        fcmToken = deviceToken.data as string;
      } catch {
        // FCM token unavailable (e.g. emulator without Play Services)
      }
    }

    // Always register with server on every launch — keeps FCM token current
    apiPost("/push-tokens", {
      token: expoToken,
      fcmToken: fcmToken ?? undefined,
      role: "customer",
    }).catch(() => {});

    return expoToken;
  } catch {
    return null;
  }
}

export function useCustomerPushToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Serve cached Expo token immediately so checkout screen has it right away
    AsyncStorage.getItem(TOKEN_KEY).then((cached) => {
      if (cached) setToken(cached);
    });

    // Always refresh in background on every launch:
    // - refreshes the FCM token stored in the DB (FCM tokens can rotate)
    // - updates the server with the latest token pair
    registerCustomerNotifications().then((fresh) => {
      if (fresh) setToken(fresh);
    });
  }, []);

  return token;
}
