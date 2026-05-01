import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";
import { MenuItem, FOOD_IMAGES, RESTAURANT_INFO } from "@/constants/menu";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

interface Props {
  item: MenuItem & { available?: boolean };
}

export function MenuItemCard({ item }: Props) {
  const colors = useColors();
  const { items, addItem, updateQuantity } = useCart();
  const cartItem = items.find((c) => c.item.id === item.id);
  const quantity = cartItem?.quantity ?? 0;
  const inCart = quantity > 0;
  const foodImage = item.imageUrl
    ? { uri: item.imageUrl }
    : item.imageKey ? FOOD_IMAGES[item.imageKey] : null;
  const isDhabiha = item.price === 0;
  const isUnavailable = item.available === false;

  const handleAdd = () => {
    if (isUnavailable) return;
    if (isDhabiha) {
      Linking.openURL(`https://wa.me/${RESTAURANT_INFO.whatsapp}?text=${encodeURIComponent(`السلام عليكم، أرغب في الاستفسار عن: ${item.name}`)}`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addItem(item);
  };

  const handleDecrease = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateQuantity(item.id, quantity - 1);
  };

  const priceStr = item.price % 1 === 0 ? item.price.toString() : item.price.toFixed(1);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isUnavailable ? "#1A1008" : colors.card,
          borderColor: isUnavailable ? colors.border : inCart ? colors.gold : colors.border,
          borderWidth: inCart ? 1.5 : 1,
          opacity: isUnavailable ? 0.7 : 1,
        },
      ]}
    >
      {isUnavailable && (
        <View style={styles.unavailableBanner}>
          <Text style={[styles.unavailableText, { fontFamily: F.bold }]}>نافد</Text>
        </View>
      )}
      <View style={styles.inner}>
        {/* Left: quantity control / add button */}
        <View style={styles.leftSide}>
          {isUnavailable ? (
            <View style={[styles.addBtn, { backgroundColor: "#3A2A1A" }]}>
              <Feather name="x" size={18} color="#666" />
            </View>
          ) : isDhabiha ? (
            <TouchableOpacity
              onPress={handleAdd}
              style={[styles.addBtn, { backgroundColor: "#1DBF47" }]}
              activeOpacity={0.8}
            >
              <Feather name="phone" size={18} color="#fff" />
            </TouchableOpacity>
          ) : quantity === 0 ? (
            <TouchableOpacity
              onPress={handleAdd}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.qtyGroup}>
              <TouchableOpacity
                onPress={handleAdd}
                style={[styles.qtyRound, { backgroundColor: colors.primary }]}
              >
                <Feather name="plus" size={14} color="#fff" />
              </TouchableOpacity>
              <View style={[styles.qtyNumBox, { backgroundColor: colors.gold }]}>
                <Text style={[styles.qtyNumText, { fontFamily: F.extra }]}>{quantity}</Text>
              </View>
              <TouchableOpacity
                onPress={handleDecrease}
                style={[styles.qtyRound, { backgroundColor: "#2A1A0A" }]}
              >
                <Feather name="minus" size={14} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Center: info */}
        <View style={styles.infoBlock}>
          <Text style={[styles.name, { color: colors.foreground, fontFamily: F.bold }]} numberOfLines={2}>
            {item.name}
          </Text>
          {item.description ? (
            <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: F.regular }]}>
              {item.description}
            </Text>
          ) : null}
          <View style={styles.priceRow}>
            {isDhabiha ? (
              <View style={[styles.callBadge, { backgroundColor: "#1DBF4722", borderColor: "#1DBF47" }]}>
                <Text style={[styles.callText, { color: "#1DBF47", fontFamily: F.bold }]}>اتصل للسعر</Text>
              </View>
            ) : (
              <>
                <Text style={[styles.currency, { color: colors.mutedForeground, fontFamily: F.regular }]}>ر.س</Text>
                <Text style={[styles.price, { color: inCart ? colors.gold : colors.accent, fontFamily: F.extra }]}>
                  {priceStr}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Right: food image */}
        {foodImage ? (
          <View style={[styles.imageWrap, { backgroundColor: "#2A1508" }]}>
            <Image source={foodImage} style={styles.foodImage} resizeMode="cover" />
            {inCart && (
              <View style={[styles.inCartDot, { backgroundColor: colors.gold }]} />
            )}
          </View>
        ) : (
          <View style={[styles.imageWrap, styles.noImage, { backgroundColor: "#2A1508", borderColor: colors.border }]}>
            <Text style={styles.noImageIcon}>🍽️</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  leftSide: {
    width: 46,
    alignItems: "center",
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#C8171A",
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  qtyGroup: {
    alignItems: "center",
    gap: 5,
  },
  qtyRound: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyNumBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyNumText: {
    color: "#fff",
    fontSize: 15,
  },
  infoBlock: {
    flex: 1,
    alignItems: "flex-end",
    gap: 4,
  },
  name: {
    fontSize: 15,
    textAlign: "right",
    lineHeight: 22,
  },
  desc: {
    fontSize: 12,
    textAlign: "right",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    marginTop: 4,
  },
  price: {
    fontSize: 22,
  },
  currency: {
    fontSize: 12,
  },
  callBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  callText: {
    fontSize: 12,
  },
  imageWrap: {
    width: 82,
    height: 82,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  foodImage: {
    width: "100%",
    height: "100%",
  },
  noImage: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noImageIcon: {
    fontSize: 32,
  },
  inCartDot: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  unavailableBanner: {
    backgroundColor: "#4A1A1A",
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: "flex-end",
  },
  unavailableText: {
    color: "#E57373",
    fontSize: 12,
  },
});
