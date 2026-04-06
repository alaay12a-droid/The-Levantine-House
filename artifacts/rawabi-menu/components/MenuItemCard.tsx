import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";
import { MenuItem } from "@/constants/menu";

interface Props {
  item: MenuItem;
}

export function MenuItemCard({ item }: Props) {
  const colors = useColors();
  const { items, addItem, updateQuantity } = useCart();
  const cartItem = items.find((c) => c.item.id === item.id);
  const quantity = cartItem?.quantity ?? 0;

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addItem(item);
  };

  const handleDecrease = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateQuantity(item.id, quantity - 1);
  };

  const priceStr = item.price % 1 === 0 ? item.price.toString() : item.price.toFixed(1);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.content}>
        <View style={styles.actions}>
          {quantity === 0 ? (
            <TouchableOpacity
              onPress={handleAdd}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={20} color={colors.primaryForeground} />
            </TouchableOpacity>
          ) : (
            <View style={styles.qtyRow}>
              <TouchableOpacity
                onPress={handleAdd}
                style={[styles.qtyBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.8}
              >
                <Feather name="plus" size={14} color={colors.primaryForeground} />
              </TouchableOpacity>
              <Text style={[styles.qtyText, { color: colors.primary }]}>{quantity}</Text>
              <TouchableOpacity
                onPress={handleDecrease}
                style={[styles.qtyBtn, { backgroundColor: colors.secondary }]}
                activeOpacity={0.8}
              >
                <Feather name="minus" size={14} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.price, { color: colors.primary }]}>
            {priceStr} ر.س
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  info: {
    flex: 1,
    alignItems: "flex-end",
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
    lineHeight: 22,
    marginBottom: 6,
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
  },
  actions: {
    alignItems: "center",
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyRow: {
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    minWidth: 20,
  },
});
