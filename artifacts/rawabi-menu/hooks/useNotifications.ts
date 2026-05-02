import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiPost } from "@/constants/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("orders", {
      name: "طلبات جديدة",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
      lightColor: "#D4AF37",
      sound: "notification_loop",
      enableVibrate: true,
      showBadge: true,
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    return null;
  }
}

export function useNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Register and persist token — never delete it on unmount so background
    // push notifications keep working when the app is closed or backgrounded.
    registerForPushNotifications().then(async (token) => {
      if (!token) return;
      try {
        await apiPost("/push-tokens", { token });
      } catch {}
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      // Token intentionally NOT deleted here — it must survive app backgrounding/closing
    };
  }, []);
}
