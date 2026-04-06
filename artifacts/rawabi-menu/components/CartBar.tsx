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
        { backgroundColor: colors.primary },
        Platform.OS === "web" && { bottom: 34 },
      ]}
    >
      <Text style={[styles.price, { color: colors.primaryForeground }]}>
        {totalStr} ر.س
      </Text>
      <Text style={[styles.label, { color: colors.primaryForeground }]}>عرض السلة</Text>
      <View style={[styles.badge, { backgroundColor: colors.gold }]}>
        <Text style={styles.badgeText}>{totalItems}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: "#C41E3A",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  price: {
    fontSize: 15,
    fontWeight: "600",
  },
});
