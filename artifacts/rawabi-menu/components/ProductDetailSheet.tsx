import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useCart, CartCustomization } from "@/context/CartContext";
import { MenuItem, FOOD_IMAGES } from "@/constants/menu";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

const RICE_OPTIONS: { label: string; extra: number }[] = [
  { label: "أرز بشاور أبيض", extra: 1 },
  { label: "أرز مندي", extra: 1 },
];

const ADDON_OPTIONS: { label: string; extra: number }[] = [
  { label: "بدون كشنة", extra: 0 },
  { label: "زيادة كشنة", extra: 0 },
];

const RICE_CATS = new Set(["chicken", "meat", "mains"]);

function itemNeedsCustomization(item: MenuItem): boolean {
  if (!RICE_CATS.has(item.category)) return false;
  if (item.description?.includes("بدون رز")) return false;
  if (item.name.includes("سادة")) return false;
  if (item.name.startsWith("رز ")) return false;
  return true;
}

interface Props {
  item: (MenuItem & { available?: boolean; nameEn?: string; descriptionEn?: string }) | null;
  visible: boolean;
  onClose: () => void;
}

export function ProductDetailSheet({ item, visible, onClose }: Props) {
  const colors = useColors();
  const { addItem } = useCart();

  const [qty, setQty] = useState(1);
  const [riceIdx, setRiceIdx] = useState(0);
  const [addonIdx, setAddonIdx] = useState(0);

  useEffect(() => {
    if (visible) {
      setQty(1);
      setRiceIdx(0);
      setAddonIdx(0);
    }
  }, [visible, item?.id]);

  if (!item) return null;

  const foodImage = item.imageUrl
    ? { uri: item.imageUrl }
    : item.imageKey ? FOOD_IMAGES[item.imageKey] : null;

  const showCustomization = itemNeedsCustomization(item);
  const selectedRice = showCustomization ? RICE_OPTIONS[riceIdx] : null;
  const selectedAddon = showCustomization ? ADDON_OPTIONS[addonIdx] : null;
  const extraPrice = (selectedRice?.extra ?? 0) + (selectedAddon?.extra ?? 0);
  const unitPrice = item.price + extraPrice;
  const totalPrice = unitPrice * qty;
  const priceStr = (v: number) => v % 1 === 0 ? v.toString() : v.toFixed(1);

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const customization: CartCustomization | undefined = showCustomization
      ? {
          riceType: selectedRice?.label,
          addon: selectedAddon?.label,
          extraPrice,
        }
      : undefined;
    addItem(item, qty, customization);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} onPress={onClose} activeOpacity={1} />

        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {/* ── Image ── */}
          <View style={styles.imageContainer}>
            {foodImage ? (
              <Image source={foodImage} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: "#2A1508" }]}>
                <Text style={{ fontSize: 56 }}>🍽️</Text>
              </View>
            )}
            {/* Close button over image */}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 120, gap: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Title ── */}
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 20, textAlign: "right" }}>
                {item.name}
              </Text>
              {item.description ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 13, textAlign: "right" }}>
                  {item.description}
                </Text>
              ) : null}
            </View>

            {/* ── Rice Type ── */}
            {showCustomization && (
              <View style={{ gap: 10 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>أنواع الأرز</Text>
                {RICE_OPTIONS.map((opt, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => { setRiceIdx(i); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={styles.optionRow}
                    activeOpacity={0.7}
                  >
                    {/* Radio circle */}
                    <View style={[
                      styles.radio,
                      { borderColor: riceIdx === i ? "#E8920C" : colors.border },
                      riceIdx === i && { backgroundColor: "#E8920C22" },
                    ]}>
                      {riceIdx === i && (
                        <View style={[styles.radioDot, { backgroundColor: "#E8920C" }]} />
                      )}
                    </View>
                    {/* Label */}
                    <Text style={{ flex: 1, color: colors.foreground, fontFamily: riceIdx === i ? F.bold : F.regular, fontSize: 15, textAlign: "right" }}>
                      {opt.label}
                    </Text>
                    {/* Extra price */}
                    <View style={styles.extraBadge}>
                      <Text style={{ color: "#E8920C", fontFamily: F.bold, fontSize: 12 }}>
                        {opt.extra === 0 ? "₩ 0" : `+ ${opt.extra} ₩`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── Add-ons ── */}
            {showCustomization && (
              <View style={{ gap: 10 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الإضافات</Text>
                {ADDON_OPTIONS.map((opt, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => { setAddonIdx(i); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={styles.optionRow}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.radio,
                      { borderColor: addonIdx === i ? "#E8920C" : colors.border },
                      addonIdx === i && { backgroundColor: "#E8920C22" },
                    ]}>
                      {addonIdx === i && (
                        <View style={[styles.radioDot, { backgroundColor: "#E8920C" }]} />
                      )}
                    </View>
                    <Text style={{ flex: 1, color: colors.foreground, fontFamily: addonIdx === i ? F.bold : F.regular, fontSize: 15, textAlign: "right" }}>
                      {opt.label}
                    </Text>
                    <View style={styles.extraBadge}>
                      <Text style={{ color: "#E8920C", fontFamily: F.bold, fontSize: 12 }}>
                        {opt.extra === 0 ? "₩ 0" : `+ ${opt.extra} ₩`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          {/* ── Fixed Footer: Qty + Add ── */}
          <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            {/* Quantity */}
            <View style={styles.qtyRow}>
              <TouchableOpacity
                onPress={() => { if (qty < 99) { setQty(qty + 1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }}
                style={[styles.qtyBtn, { backgroundColor: "#2A1508" }]}
              >
                <Feather name="plus" size={18} color="#E8920C" />
              </TouchableOpacity>
              <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 20, minWidth: 28, textAlign: "center" }}>
                {qty}
              </Text>
              <TouchableOpacity
                onPress={() => { if (qty > 1) { setQty(qty - 1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }}
                style={[styles.qtyBtn, { backgroundColor: "#2A1508" }]}
              >
                <Feather name="minus" size={18} color={qty <= 1 ? colors.border : "#E8920C"} />
              </TouchableOpacity>
            </View>

            {/* Add button */}
            <TouchableOpacity
              onPress={handleAdd}
              style={[styles.addBtn, { backgroundColor: "#C8171A" }]}
              activeOpacity={0.85}
            >
              <Text style={{ color: "#fff", fontFamily: F.extra, fontSize: 17 }}>
                {priceStr(totalPrice)} ر.س
              </Text>
              <Text style={{ color: "#fff99A", fontFamily: F.bold, fontSize: 14 }}>إضافة</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#00000080",
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    maxHeight: "88%",
  },
  imageContainer: {
    width: "100%",
    height: 230,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#00000088",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    textAlign: "right",
    opacity: 0.6,
    marginBottom: 2,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ffffff18",
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  extraBadge: {
    minWidth: 44,
    alignItems: "flex-end",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    gap: 14,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  qtyBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
});
