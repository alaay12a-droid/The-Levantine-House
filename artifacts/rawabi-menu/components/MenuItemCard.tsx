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
  index?: number;
}

export function MenuItemCard({ item, index = 0 }: Props) {
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
  const inCart = quantity > 0;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: inCart ? "#1F1308" : colors.card,
          borderColor: inCart ? colors.gold : colors.border,
        },
      ]}
    >
      {/* Gold accent on left if in cart */}
      {inCart && (
        <View style={[styles.inCartAccent, { backgroundColor: colors.gold }]} />
      )}

      <View style={styles.content}>
        {/* Add / Qty controls */}
        <View style={styles.controls}>
          {quantity === 0 ? (
            <TouchableOpacity
              onPress={handleAdd}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.qtyColumn}>
              <TouchableOpacity
                onPress={handleAdd}
                style={[styles.qtySmallBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.8}
              >
                <Feather name="plus" size={13} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={[styles.qtyBadge, { backgroundColor: colors.gold }]}>
                <Text style={styles.qtyText}>{quantity}</Text>
              </View>
              <TouchableOpacity
                onPress={handleDecrease}
                style={[styles.qtySmallBtn, { backgroundColor: colors.secondary }]}
                activeOpacity={0.8}
              >
                <Feather name="minus" size={13} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
            {item.name}
          </Text>
          {item.description ? (
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              {item.description}
            </Text>
          ) : null}
          <View style={styles.priceRow}>
            <Text style={[styles.currency, { color: colors.mutedForeground }]}>ر.س</Text>
            <Text style={[styles.price, { color: inCart ? colors.gold : colors.primary }]}>
              {priceStr}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
    position: "relative",
  },
  inCartAccent: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 14,
  },
  info: {
    flex: 1,
    alignItems: "flex-end",
  },
  name: {
    fontSize: 15.5,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 23,
    marginBottom: 3,
  },
  description: {
    fontSize: 12,
    textAlign: "right",
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  price: {
    fontSize: 20,
    fontWeight: "800",
  },
  currency: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 2,
  },
  controls: {
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#C8171A",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  qtyColumn: {
    alignItems: "center",
    gap: 5,
  },
  qtySmallBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
