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
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";
import { RESTAURANT_INFO } from "@/constants/menu";

export default function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items, updateQuantity, removeItem, clearCart, totalItems, totalPrice } = useCart();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const handleOrder = async () => {
    if (items.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    let message = `*طلب جديد من تطبيق روابي المندي*\n\n`;
    message += `*الطلبيات:*\n`;
    items.forEach((cartItem) => {
      const itemTotal = cartItem.item.price * cartItem.quantity;
      const priceStr = itemTotal % 1 === 0 ? itemTotal.toString() : itemTotal.toFixed(1);
      message += `• ${cartItem.item.name} × ${cartItem.quantity} = ${priceStr} ر.س\n`;
    });
    const totalStr = totalPrice % 1 === 0 ? totalPrice.toString() : totalPrice.toFixed(1);
    message += `\n*المجموع الكلي: ${totalStr} ر.س*`;

    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${RESTAURANT_INFO.whatsapp}?text=${encoded}`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("خطأ", "تعذر فتح واتساب. يرجى الاتصال مباشرة على الرقم: " + RESTAURANT_INFO.phone);
    }
  };

  const handleCall = () => {
    Linking.openURL(`tel:${RESTAURANT_INFO.phone}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
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
          <Feather name="arrow-right" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>سلة الطلبات</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={() => clearCart()} style={styles.clearBtn}>
            <Text style={[styles.clearText, { color: colors.primary }]}>مسح الكل</Text>
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="shopping-cart" size={64} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>السلة فارغة</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            أضف بعض الأصناف من القائمة
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.browseBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.browseBtnText, { color: colors.primaryForeground }]}>
              تصفح القائمة
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.list, { paddingBottom: 200 }]}
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
                  <View style={styles.cardTop}>
                    <TouchableOpacity
                      onPress={() => removeItem(cartItem.item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="x" size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    <Text style={[styles.cartItemName, { color: colors.foreground }]} numberOfLines={2}>
                      {cartItem.item.name}
                    </Text>
                  </View>

                  <View style={styles.cardBottom}>
                    <View style={styles.qtyControls}>
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          updateQuantity(cartItem.item.id, cartItem.quantity + 1);
                        }}
                        style={[styles.qtyBtn, { backgroundColor: colors.primary }]}
                      >
                        <Feather name="plus" size={14} color={colors.primaryForeground} />
                      </TouchableOpacity>
                      <Text style={[styles.qtyNum, { color: colors.foreground }]}>
                        {cartItem.quantity}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          updateQuantity(cartItem.item.id, cartItem.quantity - 1);
                        }}
                        style={[styles.qtyBtn, { backgroundColor: colors.secondary }]}
                      >
                        <Feather name="minus" size={14} color={colors.foreground} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.priceInfo}>
                      <Text style={[styles.cartItemPrice, { color: colors.primary }]}>
                        {totalStr} ر.س
                      </Text>
                      <Text style={[styles.unitPriceText, { color: colors.mutedForeground }]}>
                        {unitStr} ر.س / وحدة
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Bottom Action */}
          <View
            style={[
              styles.bottomPanel,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
                paddingBottom: bottomInset + 16,
              },
            ]}
          >
            <View style={styles.totalRow}>
              <Text style={[styles.totalAmount, { color: colors.primary }]}>
                {totalPrice % 1 === 0 ? totalPrice : totalPrice.toFixed(1)} ر.س
              </Text>
              <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
                المجموع ({totalItems} أصناف)
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleOrder}
              style={[styles.orderBtn, { backgroundColor: "#25D366" }]}
              activeOpacity={0.85}
            >
              <Feather name="message-circle" size={20} color="#fff" />
              <Text style={styles.orderBtnText}>أرسل الطلب عبر واتساب</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCall}
              style={[styles.callBtn, { borderColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Feather name="phone" size={18} color={colors.primary} />
              <Text style={[styles.callBtnText, { color: colors.primary }]}>
                اتصل بنا: {RESTAURANT_INFO.phone}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "right",
  },
  clearBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  clearText: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
  },
  browseBtn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  list: {
    padding: 16,
  },
  cartCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    padding: 14,
    gap: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  cartItemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
    lineHeight: 22,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyNum: {
    fontSize: 16,
    fontWeight: "700",
    minWidth: 24,
    textAlign: "center",
  },
  priceInfo: {
    alignItems: "flex-end",
  },
  cartItemPrice: {
    fontSize: 17,
    fontWeight: "700",
  },
  unitPriceText: {
    fontSize: 12,
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 14,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: "700",
  },
  orderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 14,
  },
  orderBtnText: {
    color: "#fff",
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
    borderWidth: 1.5,
  },
  callBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
