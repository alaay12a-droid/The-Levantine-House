import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";

export function CartBar() {
  const colors = useColors();
  const { totalItems, totalPrice } = useCart();
  const router = useRouter();

  if (totalItems === 0) return null;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/cart");
  };

  const totalStr = totalPrice % 1 === 0 ? totalPrice.toString() : totalPrice.toFixed(1);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.9}
      style={[
        styles.bar,
        Platform.OS === "web" && { bottom: 34 },
      ]}
    >
      {/* Left: price */}
      <View style={styles.priceBlock}>
        <Text style={styles.totalStr}>{totalStr}</Text>
        <Text style={styles.sar}>ر.س</Text>
      </View>

      {/* Center: label */}
      <Text style={styles.label}>عرض سلة الطلبات</Text>

      {/* Right: badge */}
      <View style={[styles.badge, { backgroundColor: "#FFFFFF22" }]}>
        <Feather name="shopping-cart" size={14} color="#FFFFFF" />
        <Text style={styles.badgeText}>{totalItems}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    bottom: 22,
    left: 16,
    right: 16,
    borderRadius: 18,
    backgroundColor: "#C8171A",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    shadowColor: "#C8171A",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  priceBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  totalStr: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  sar: {
    fontSize: 12,
    color: "#FFFFFF99",
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    color: "#FFFFFF",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
