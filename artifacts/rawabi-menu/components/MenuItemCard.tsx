import React, { useState } from "react";
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
import { useLanguage } from "@/context/LanguageContext";
import { useFavorites } from "@/hooks/useFavorites";
import { MenuItem, FOOD_IMAGES } from "@/constants/menu";
import { useAppTexts } from "@/hooks/useAppTexts";
import { ProductDetailSheet } from "@/components/ProductDetailSheet";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

interface Props {
  item: MenuItem & { available?: boolean; nameEn?: string; descriptionEn?: string };
}

export function MenuItemCard({ item }: Props) {
  const colors = useColors();
  const { items, addItem, updateQuantity } = useCart();
  const { language } = useLanguage();
  const { isFavorite, toggleFavorite } = useFavorites();
  const isEn = language === "en";
  const info = useAppTexts();

  const [showDetail, setShowDetail] = useState(false);

  const cartItem = items.find((c) => c.item.id === item.id);
  const quantity = cartItem?.quantity ?? 0;
  const inCart = quantity > 0;
  const foodImage = item.imageUrl
    ? { uri: item.imageUrl }
    : item.imageKey ? FOOD_IMAGES[item.imageKey] : null;
  const isDhabiha = item.price === 0;
  const isUnavailable = item.available === false;
  const faved = isFavorite(item.id);

  const stockLimit = (item.stock !== null && item.stock !== undefined) ? item.stock : null;
  const atStockLimit = stockLimit !== null && quantity >= stockLimit;
  const lowStock = stockLimit !== null && stockLimit > 0 && stockLimit <= 3;

  const displayName = isEn && item.nameEn ? item.nameEn : item.name;
  const displayDesc = isEn && item.descriptionEn ? item.descriptionEn : item.description;

  const handleAdd = () => {
    if (isUnavailable || atStockLimit) return;
    if (isDhabiha) {
      const msg = isEn
        ? `Hello, I would like to inquire about: ${displayName}`
        : `السلام عليكم، أرغب في الاستفسار عن: ${item.name}`;
      Linking.openURL(`https://wa.me/${info.whatsapp}?text=${encodeURIComponent(msg)}`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addItem(item);
  };

  const handleDecrease = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateQuantity(item.id, quantity - 1);
  };

  const handleToggleFav = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavorite(item.id);
  };

  const priceStr = item.price % 1 === 0 ? item.price.toString() : item.price.toFixed(1);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isUnavailable ? (colors.isLight ? "#F5F0EA" : "#1A1008") : colors.card,
          borderColor: inCart ? colors.gold : colors.border,
          borderWidth: inCart ? 1.5 : 0.8,
          opacity: isUnavailable ? 0.7 : 1,
        },
      ]}
    >
      {isUnavailable && (
        <View style={[styles.statusBanner, { backgroundColor: colors.isLight ? "#F0D8D8" : "#4A1A1A" }]}>
          <Text style={[styles.statusText, { color: colors.isLight ? "#C8171A" : "#E57373", fontFamily: F.bold }]}>
            {isEn ? "Out of Stock" : "نافد"}
          </Text>
        </View>
      )}
      {!isUnavailable && lowStock && (
        <View style={[styles.statusBanner, { backgroundColor: colors.isLight ? "#FFF3E0" : "#3A2000" }]}>
          <Text style={[styles.statusText, { color: "#E8920C", fontFamily: F.bold }]}>
            {isEn ? `Only ${stockLimit} left` : `متبقي ${stockLimit} فقط`}
          </Text>
        </View>
      )}

      <View style={styles.inner}>
        {/* Right: food image */}
        <TouchableOpacity
          onPress={() => { if (!isUnavailable && !isDhabiha) setShowDetail(true); }}
          activeOpacity={isUnavailable || isDhabiha ? 1 : 0.85}
          disabled={isUnavailable || isDhabiha}
          style={styles.imageContainer}
        >
          {foodImage ? (
            <View style={[styles.imageWrap, { backgroundColor: colors.isLight ? "#E8D8C8" : "#2A1508" }]}>
              <Image source={foodImage} style={styles.foodImage} resizeMode="cover" />
              {inCart && (
                <View style={[styles.inCartDot, { backgroundColor: colors.gold }]} />
              )}
              {!isUnavailable && !isDhabiha && (
                <View style={styles.zoomHint}>
                  <Feather name="zoom-in" size={11} color="#ffffffcc" />
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.imageWrap, styles.noImage, { backgroundColor: colors.isLight ? "#EDE0CE" : "#2A1508", borderColor: colors.border }]}>
              <Text style={styles.noImageIcon}>🍽️</Text>
            </View>
          )}
          {/* Heart button on image */}
          <TouchableOpacity
            onPress={handleToggleFav}
            style={[styles.heartBtn, { backgroundColor: faved ? "#C8171A22" : "#00000044" }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="heart" size={12} color={faved ? "#C8171A" : "#ffffffbb"} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Center: info */}
        <View style={[styles.infoBlock, { alignItems: isEn ? "flex-start" : "flex-end" }]}>
          <Text
            style={[styles.name, { color: colors.foreground, fontFamily: F.bold, textAlign: isEn ? "left" : "right" }]}
            numberOfLines={2}
          >
            {displayName}
          </Text>
          {displayDesc ? (
            <Text
              style={[styles.desc, { color: colors.mutedForeground, fontFamily: F.regular, textAlign: isEn ? "left" : "right" }]}
              numberOfLines={2}
            >
              {displayDesc}
            </Text>
          ) : null}

          {/* Price row + add button */}
          <View style={styles.bottomRow}>
            {/* Add / quantity control */}
            {isUnavailable ? (
              <View style={[styles.addBtn, { backgroundColor: colors.isLight ? "#E0D0C0" : "#3A2A1A" }]}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </View>
            ) : isDhabiha ? (
              <TouchableOpacity
                onPress={handleAdd}
                style={[styles.addBtn, { backgroundColor: "#1DBF47" }]}
                activeOpacity={0.8}
              >
                <Feather name="phone" size={16} color="#fff" />
              </TouchableOpacity>
            ) : quantity === 0 ? (
              <TouchableOpacity
                onPress={handleAdd}
                style={[styles.addBtn, { backgroundColor: atStockLimit ? (colors.isLight ? "#E0D0C0" : "#3A2A1A") : colors.primary }]}
                activeOpacity={atStockLimit ? 1 : 0.8}
                disabled={atStockLimit}
              >
                <Feather name="plus" size={18} color={atStockLimit ? colors.mutedForeground : "#fff"} />
              </TouchableOpacity>
            ) : (
              <View style={styles.qtyGroup}>
                <TouchableOpacity
                  onPress={handleAdd}
                  style={[styles.qtyRound, { backgroundColor: atStockLimit ? (colors.isLight ? "#E0D0C0" : "#2A1A0A") : colors.primary }]}
                  disabled={atStockLimit}
                >
                  <Feather name="plus" size={13} color={atStockLimit ? colors.mutedForeground : "#fff"} />
                </TouchableOpacity>
                <View style={[styles.qtyNumBox, { backgroundColor: colors.gold }]}>
                  <Text style={[styles.qtyNumText, { fontFamily: F.extra }]}>{quantity}</Text>
                </View>
                <TouchableOpacity
                  onPress={handleDecrease}
                  style={[styles.qtyRound, { backgroundColor: colors.isLight ? "#E0D0C0" : "#2A1A0A" }]}
                >
                  <Feather name="minus" size={13} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            )}

            {/* Price */}
            <View style={styles.priceBlock}>
              {isDhabiha ? (
                <View style={[styles.callBadge, { backgroundColor: "#1DBF4722", borderColor: "#1DBF47" }]}>
                  <Text style={[styles.callText, { color: "#1DBF47", fontFamily: F.bold }]}>
                    {isEn ? "Call for price" : "اتصل للسعر"}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.price, { color: inCart ? colors.gold : colors.accent, fontFamily: F.extra }]}>
                    {priceStr}
                  </Text>
                  <Text style={[styles.currency, { color: colors.mutedForeground, fontFamily: F.semi }]}>
                    {isEn ? "SAR" : "ر.س"}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
      </View>

      <ProductDetailSheet
        item={item}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    marginBottom: 10,
    overflow: "hidden",
  },
  inner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 14,
    gap: 14,
  },
  imageContainer: {
    position: "relative",
  },
  imageWrap: {
    width: 100,
    height: 100,
    borderRadius: 14,
    overflow: "hidden",
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
    fontSize: 36,
  },
  inCartDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  zoomHint: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#00000066",
    alignItems: "center",
    justifyContent: "center",
  },
  heartBtn: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  infoBlock: {
    flex: 1,
    gap: 5,
  },
  name: {
    fontSize: 15,
    lineHeight: 23,
  },
  desc: {
    fontSize: 12,
    lineHeight: 18,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#C8171A",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  qtyGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  qtyRound: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyNumBox: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyNumText: {
    color: "#fff",
    fontSize: 14,
  },
  priceBlock: {
    alignItems: "flex-end",
  },
  price: {
    fontSize: 22,
    lineHeight: 26,
  },
  currency: {
    fontSize: 11,
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
  statusBanner: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    alignItems: "flex-end",
  },
  statusText: {
    fontSize: 12,
  },
});
