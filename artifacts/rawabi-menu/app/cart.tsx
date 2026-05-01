import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  Alert,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";
import { useUser } from "@/context/UserContext";
import { RESTAURANT_INFO } from "@/constants/menu";

export default function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items, updateQuantity, removeItem, clearCart, totalItems, totalPrice } = useCart();
  const { user } = useUser();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const handleOrder = async () => {
    if (items.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    let message = `🍗 *طلب جديد - روابي المندي للمذاق فن وأصول*\n\n`;
    if (user) {
      message += `👤 *العميل:* ${user.name}\n`;
      message += `📱 *الجوال:* ${user.phone}\n`;
      if (user.address && user.address !== "غير محدد") {
        message += `📍 *العنوان:* ${user.address}\n`;
      }
      if (user.lat && user.lng) {
        message += `🗺️ *الخريطة:* https://maps.google.com/?q=${user.lat},${user.lng}\n`;
      }
      message += `\n`;
    }
    message += `📋 *تفاصيل الطلب:*\n`;
    items.forEach((cartItem, i) => {
      const itemTotal = cartItem.item.price * cartItem.quantity;
      const priceStr = itemTotal % 1 === 0 ? itemTotal.toString() : itemTotal.toFixed(1);
      message += `${i + 1}. ${cartItem.item.name}\n   × ${cartItem.quantity} = ${priceStr} ر.س\n`;
    });
    const totalStr = totalPrice % 1 === 0 ? totalPrice.toString() : totalPrice.toFixed(1);
    message += `\n💰 *الإجمالي: ${totalStr} ر.س*`;

    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${RESTAURANT_INFO.whatsapp}?text=${encoded}`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("خطأ", "تعذر فتح واتساب. يرجى الاتصال على: " + RESTAURANT_INFO.phone);
    }
  };

  const handleCall = () => {
    Linking.openURL(`tel:${RESTAURANT_INFO.phone}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: "#1A1008",
            paddingTop: topInset + 8,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.secondary }]}
          activeOpacity={0.7}
        >
          <Feather name="arrow-right" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>سلة الطلبات</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={() => clearCart()}>
            <Text style={[styles.clearText, { color: colors.mutedForeground }]}>مسح الكل</Text>
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
            <Feather name="shopping-cart" size={44} color={colors.border} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>السلة فارغة</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            أضف بعض الأصناف من قائمتنا الشهية
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.browseBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Text style={styles.browseBtnText}>تصفح القائمة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.list, { paddingBottom: 220 }]}
          >
            {items.map((cartItem) => {
              const itemTotal = cartItem.item.price * cartItem.quantity;
              const totalStr = itemTotal % 1 === 0 ? itemTotal.toString() : itemTotal.toFixed(1);
              const unitStr = cartItem.item.price % 1 === 0
                ? cartItem.item.price.toString()
                : cartItem.item.price.toFixed(1);
              return (
                <View
                  key={cartItem.item.id}
                  style={[
                    styles.cartCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  {/* Gold bar */}
                  <View style={[styles.goldBar, { backgroundColor: colors.gold }]} />

                  <View style={styles.cardInner}>
                    <View style={styles.cardTop}>
                      <TouchableOpacity
                        onPress={() => removeItem(cartItem.item.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={[styles.removeBtn, { backgroundColor: "#3A2410" }]}
                      >
                        <Feather name="x" size={14} color={colors.mutedForeground} />
                      </TouchableOpacity>
                      <Text style={[styles.cartItemName, { color: colors.foreground }]} numberOfLines={2}>
                        {cartItem.item.name}
                      </Text>
                    </View>

                    <View style={styles.cardBottom}>
                      <View style={styles.qtyRow}>
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            updateQuantity(cartItem.item.id, cartItem.quantity + 1);
                          }}
                          style={[styles.qtyBtn, { backgroundColor: colors.primary }]}
                        >
                          <Feather name="plus" size={13} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={[styles.qtyDisplay, { backgroundColor: colors.gold }]}>
                          <Text style={styles.qtyNum}>{cartItem.quantity}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            updateQuantity(cartItem.item.id, cartItem.quantity - 1);
                          }}
                          style={[styles.qtyBtn, { backgroundColor: colors.secondary }]}
                        >
                          <Feather name="minus" size={13} color={colors.foreground} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.priceBlock}>
                        <Text style={[styles.itemTotal, { color: colors.gold }]}>
                          {totalStr} ر.س
                        </Text>
                        <Text style={[styles.unitPrice, { color: colors.mutedForeground }]}>
                          {unitStr} ر.س للوحدة
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Bottom Panel */}
          <View
            style={[
              styles.bottomPanel,
              {
                backgroundColor: "#1A1008",
                borderTopColor: colors.border,
                paddingBottom: bottomInset + 16,
              },
            ]}
          >
            {/* Summary */}
            <View style={[styles.summaryBox, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.summaryTotal, { color: colors.gold }]}>
                {totalPrice % 1 === 0 ? totalPrice : totalPrice.toFixed(1)} ر.س
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                إجمالي {totalItems} صنف
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push("/checkout")}
              style={styles.checkoutBtn}
              activeOpacity={0.85}
            >
              <Feather name="check-circle" size={22} color="#FFFFFF" />
              <Text style={styles.checkoutText}>إتمام الطلب</Text>
            </TouchableOpacity>

          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "right",
  },
  clearText: {
    fontSize: 13,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  browseBtn: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 14,
  },
  browseBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  list: {
    padding: 16,
  },
  cartCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
    flexDirection: "row",
  },
  goldBar: {
    width: 4,
  },
  cardInner: {
    flex: 1,
    padding: 13,
    gap: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  cartItemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 22,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyDisplay: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyNum: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  priceBlock: {
    alignItems: "flex-end",
  },
  itemTotal: {
    fontSize: 18,
    fontWeight: "800",
  },
  unitPrice: {
    fontSize: 11,
    marginTop: 2,
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  summaryBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  summaryTotal: {
    fontSize: 24,
    fontWeight: "800",
  },
  summaryLabel: {
    fontSize: 13,
  },
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 15,
    backgroundColor: "#C17F24",
    shadowColor: "#C17F24",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  checkoutText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  whatsappBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
  },
  whatsappText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  callText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
