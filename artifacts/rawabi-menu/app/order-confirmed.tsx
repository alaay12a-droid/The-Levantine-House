import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

export default function OrderConfirmedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const topInset = Platform.OS === "web" ? 80 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topInset, paddingBottom: bottomInset }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: "#1A3A1A", borderColor: "#2A6A2A" }]}>
          <Feather name="check-circle" size={64} color="#4CAF50" />
        </View>

        <Text style={[styles.title, { color: colors.foreground, fontFamily: F.extra }]}>
          تم استلام طلبك!
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: F.regular }]}>
          رقم الطلب: #{orderId}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: F.regular }]}>
          سيتم تحضير طلبك في أقرب وقت.{"\n"}شكراً لاختيارك روابي المندي 🍗
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => router.replace("/(tabs)")}
        style={[styles.btn, { backgroundColor: colors.primary }]}
        activeOpacity={0.85}
      >
        <Text style={[styles.btnText, { fontFamily: F.bold }]}>العودة للقائمة</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    padding: 32,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
  },
  desc: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 26,
  },
  btn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 17,
  },
});
