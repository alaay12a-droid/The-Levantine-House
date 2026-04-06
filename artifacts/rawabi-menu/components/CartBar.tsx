import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCart } from "@/context/CartContext";

export function CartBar() {
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
      style={[styles.bar, Platform.OS === "web" && { bottom: 34 }]}
    >
      <View style={styles.leftSection}>
        <Text style={styles.sarLabel}>ر.س</Text>
        <Text style={styles.totalText}>{totalStr}</Text>
      </View>

      <Text style={styles.centerLabel}>عرض سلة الطلبات</Text>

      <View style={styles.rightSection}>
        <Feather name="shopping-cart" size={16} color="#fff" />
        <Text style={styles.countText}>{totalItems}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    bottom: 22,
    left: 14,
    right: 14,
    borderRadius: 20,
    backgroundColor: "#C8171A",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: "#C8171A",
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 14,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    minWidth: 70,
  },
  sarLabel: {
    color: "#FFFFFF99",
    fontSize: 11,
  },
  totalText: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
  },
  centerLabel: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#00000033",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 55,
    justifyContent: "center",
  },
  countText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
