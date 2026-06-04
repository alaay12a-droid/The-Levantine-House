import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MapWebView } from "@/components/MapWebView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiGet, API_BASE } from "@/constants/api";
import { useLanguage } from "@/context/LanguageContext";

const F = {
  regular: "Cairo_400Regular",
  semi:    "Cairo_600SemiBold",
  bold:    "Cairo_700Bold",
  extra:   "Cairo_800ExtraBold",
};

interface AssignmentRow {
  driver: { id: number; name: string; phone: string; photoUrl?: string | null };
  assignment: {
    orderId: number;
    status: "assigned" | "picked_up" | "delivered";
    driverLat?: number | null;
    driverLng?: number | null;
  };
}

export default function DriverMapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { language } = useLanguage();
  const isEn = language === "en";

  const [assignment, setAssignment] = useState<AssignmentRow | null>(null);
  const [hasLocation, setHasLocation] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAssignment = useCallback(async () => {
    if (!orderId) return;
    try {
      const row = await apiGet<AssignmentRow | null>(`/orders/${orderId}/assignment`);
      if (!row) return;
      setAssignment(row);
      if (row.assignment.driverLat && row.assignment.driverLng) setHasLocation(true);
    } catch {}
  }, [orderId]);

  useEffect(() => {
    fetchAssignment();
    pollRef.current = setInterval(fetchAssignment, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchAssignment]);

  const mapUrl = Platform.OS === "web"
    ? `/api/map/${orderId}`
    : `${API_BASE}/api/map/${orderId}`;

  const topInset = Platform.OS === "web" ? 80 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        paddingTop: topInset + 8,
        paddingBottom: 12,
        paddingHorizontal: 16,
        flexDirection: "row-reverse",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 18 }}>
          {isEn ? "Live Driver Tracking" : "تتبع المندوب مباشر"}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: 8, backgroundColor: colors.secondary, borderRadius: 10 }}
        >
          <Feather name="x" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Driver badge */}
      {assignment && (
        <View style={{
          flexDirection: "row-reverse",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: "#0D2030",
          borderBottomWidth: 1,
          borderBottomColor: "#29B6F633",
        }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#29B6F622", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#29B6F655" }}>
            <Text style={{ fontSize: 20 }}>🛵</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: "#29B6F6", fontFamily: F.bold, fontSize: 14, textAlign: "right" }}>
              {assignment.driver.name}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11, textAlign: "right" }}>
              {isEn ? "Live location · updates every 10s" : "موقع مباشر · يُحدَّث كل 10 ثوانٍ"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4CAF50" }} />
            <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 11 }}>
              {isEn ? "LIVE" : "مباشر"}
            </Text>
          </View>
        </View>
      )}

      {/* Map — web uses <iframe>, native uses react-native-webview */}
      {orderId ? (
        <MapWebView uri={mapUrl} style={{ flex: 1 }} />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 14 }}>
            {isEn ? "Order not found" : "الطلب غير موجود"}
          </Text>
        </View>
      )}
    </View>
  );
}
