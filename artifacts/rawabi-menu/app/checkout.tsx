import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";
import { useUser } from "@/context/UserContext";
import { apiPost, apiGet } from "@/constants/api";
import { useCustomerPushToken } from "@/hooks/useCustomerPushToken";
import { useOrderBadge } from "@/context/OrderBadgeContext";
import { usePaymentSettings } from "@/hooks/usePaymentSettings";
import { ORDERS_STORAGE_KEY, StoredOrder } from "./(tabs)/orders";
import { useTranslation } from "@/hooks/useTranslation";
import { useLanguage } from "@/context/LanguageContext";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

type PaymentMethod = "cash" | "moyasar" | "wallet";

interface Order {
  id: number;
  dailyNumber: number;
  status: string;
}

export default function CheckoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items, totalPrice, totalItems, clearCart, updateQuantity } = useCart();
  const { user } = useUser();

  const customerPushToken = useCustomerPushToken();
  const { incrementBadge } = useOrderBadge();
  const { settings: paymentSettings } = usePaymentSettings();

  const { t } = useTranslation();
  const { language } = useLanguage();
  const isEn = language === "en";
  const [notes, setNotes] = useState("");
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [loading, setLoading] = useState(false);
  const [locationUrl, setLocationUrl] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const [otpStep, setOtpStep] = useState<"idle" | "sent" | "verified">("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  React.useEffect(() => {
    if (user?.phone) {
      apiGet<{ phone: string; balance: number }>(`/wallet?phone=${encodeURIComponent(user.phone)}`)
        .then((w) => setWalletBalance(w.balance))
        .catch(() => {});
    }
  }, [user?.phone]);

  const handleGetLocation = async () => {
    setLocationLoading(true);
    try {
      if (Platform.OS === "web") {
        if (!navigator.geolocation) {
          Alert.alert(isEn ? "Not Supported" : "غير مدعوم", isEn ? "Your browser does not support location." : "متصفحك لا يدعم تحديد الموقع");
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const url = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
            setLocationUrl(url);
            setLocationLoading(false);
          },
          () => {
            Alert.alert(isEn ? "Location Failed" : "تعذّر التحديد", isEn ? "Please allow location access in your browser settings." : "يرجى السماح للمتصفح بالوصول للموقع من الإعدادات");
            setLocationLoading(false);
          }
        );
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(isEn ? "Permission Denied" : "الإذن مرفوض", isEn ? "Please allow location access in device settings." : "يرجى السماح للتطبيق بالوصول لموقعك من إعدادات الجهاز");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const url = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
      setLocationUrl(url);
    } catch {
      Alert.alert(isEn ? "Error" : "خطأ", isEn ? "Could not get location. Please try again." : "تعذّر تحديد الموقع، حاول مرة أخرى");
    } finally {
      setLocationLoading(false);
    }
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const deliveryFee = (paymentSettings.deliveryEnabled && orderType === "delivery")
    ? (paymentSettings.deliveryFee ?? 0)
    : 0;
  const grandTotal = totalPrice + deliveryFee;
  const grandTotalStr = grandTotal % 1 === 0 ? grandTotal.toString() : grandTotal.toFixed(2);
  const deliveryFeeStr = deliveryFee % 1 === 0 ? deliveryFee.toString() : deliveryFee.toFixed(2);

  const handleSendOtp = async () => {
    if (!user?.phone) return;
    setOtpLoading(true);
    try {
      const r = await apiPost<{ ok: boolean; skipped?: boolean }>("/sms/send-otp", { phone: user.phone });
      if (r.skipped) { setOtpStep("verified"); return; }
      setOtpStep("sent");
      setOtpCode("");
    } catch {
      Alert.alert(isEn ? "Error" : "خطأ", isEn ? "Could not send code. Please try again." : "تعذر إرسال الرمز، حاول مرة أخرى.");
    } finally {
      setOtpLoading(false);
    }
  };

  const submitOrder = async () => {
    if (!user) return;
    if (paymentMethod === "moyasar") {
      Alert.alert(isEn ? "Coming Soon" : "قريباً", isEn ? "Online payment will be available soon. Please choose Cash on Delivery." : "الدفع الإلكتروني سيكون متاحاً قريباً. يرجى اختيار الدفع عند الاستلام.", [{ text: isEn ? "OK" : "حسناً" }]);
      return;
    }
    if (paymentMethod === "wallet") {
      if (walletBalance === null || walletBalance < grandTotal) {
        Alert.alert(t("error"), t("insufficientBalance") + ` (${walletBalance ?? 0} ${t("sar")})`);
        return;
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(true);
    try {
      // ── فحص المخزون الطازج قبل الإرسال ────────────────────────────────────
      try {
        type FreshItem = { itemId: string; stock: number | null; available: boolean; name: string };
        const freshMenu = await apiGet<FreshItem[]>("/menu");
        const adjustments: string[] = [];
        for (const ci of items) {
          const fresh = freshMenu.find((m) => m.itemId === ci.item.id);
          if (!fresh || fresh.stock === null) continue;
          if (ci.quantity > fresh.stock) {
            if (fresh.stock === 0) {
              updateQuantity(ci.item.id, 0); // remove from cart
              adjustments.push(isEn ? `"${ci.item.name}" is out of stock and was removed` : `"${ci.item.name}" نفد المخزون وتم إزالته`);
            } else {
              updateQuantity(ci.item.id, fresh.stock); // reduce to available
              adjustments.push(isEn ? `"${ci.item.name}": reduced to ${fresh.stock} (available qty)` : `"${ci.item.name}": تم تعديل الكمية إلى ${fresh.stock} فقط`);
            }
          }
        }
        if (adjustments.length > 0) {
          setLoading(false);
          Alert.alert(
            isEn ? "Cart Updated" : "تم تعديل السلة",
            (isEn ? "Some items were adjusted:\n" : "تم تعديل بعض الأصناف:\n") + adjustments.join("\n"),
            [{ text: isEn ? "Review & Confirm" : "مراجعة وتأكيد" }]
          );
          return;
        }
      } catch { /* if stock check fails, let backend validate */ }

      const order = await apiPost<Order>("/orders", {
        customerName: user.name,
        customerPhone: user.phone,
        customerAddress: locationUrl || user.address || null,
        items: items.map((ci) => ({
          id: ci.item.id,
          name: ci.item.name,
          price: ci.item.price,
          quantity: ci.quantity,
        })),
        totalPrice: grandTotal,
        deliveryFee,
        paymentMethod,
        notes: [
          paymentSettings.deliveryEnabled
            ? (orderType === "delivery" ? "🚗 توصيل" : "🏪 استلام من الفرع")
            : null,
          paymentMethod === "wallet" ? "💰 محفظة" : null,
          notes.trim() || null,
        ].filter(Boolean).join(" | ") || null,
        customerPushToken: customerPushToken ?? null,
      });
      if (paymentMethod === "wallet") {
        try {
          await apiPost("/wallet/pay", { phone: user.phone, amount: grandTotal, orderId: order.id });
          setWalletBalance((prev) => (prev !== null ? prev - grandTotal : null));
        } catch {}
      }
      const storedOrder: StoredOrder = {
        id: order.id,
        dailyNumber: order.dailyNumber,
        createdAt: new Date().toISOString(),
        total: grandTotal,
        items: items.map((ci) => ({ name: ci.item.name, quantity: ci.quantity })),
        customerName: user.name,
      };
      try {
        const raw = await AsyncStorage.getItem(ORDERS_STORAGE_KEY);
        const prev: StoredOrder[] = raw ? JSON.parse(raw) : [];
        await AsyncStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify([storedOrder, ...prev]));
        incrementBadge();
      } catch {}
      clearCart();
      router.replace({ pathname: "/order-confirmed", params: { orderId: String(order.id) } });
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      Alert.alert(
        isEn ? "Error" : "خطأ",
        msg && msg !== `HTTP 409` && msg !== `HTTP 400`
          ? msg
          : isEn ? "Could not place order. Please try again." : "تعذر إرسال الطلب، يرجى المحاولة مرة أخرى."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!user?.phone || otpCode.length !== 4) return;
    setOtpLoading(true);
    try {
      await apiPost("/sms/verify-otp", { phone: user.phone, code: otpCode });
      setOtpStep("verified");
      setOtpCode("");
      await submitOrder();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "الرمز غير صحيح";
      Alert.alert("خطأ", msg);
    } finally {
      setOtpLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!user) return;
    if (items.length === 0) return;
    try {
      const branchStatus = await apiGet<{ isOpen: boolean; message: string | null }>("/branch-status");
      if (!branchStatus.isOpen) {
        Alert.alert(isEn ? "Branch Closed 🔒" : "الفرع مغلق 🔒", branchStatus.message ?? (isEn ? "The branch is currently closed. Please try again later." : "الفرع مغلق حالياً، يرجى المحاولة لاحقاً"));
        return;
      }
    } catch {}
    if (otpStep !== "verified") {
      try {
        const smsSettings = await apiGet<{ enabled: boolean }>("/sms-settings");
        if (smsSettings.enabled) {
          await handleSendOtp();
          return;
        }
      } catch {}
    }
    await submitOrder();
  };

  const GOLD = colors.gold;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, paddingTop: topInset + 10, borderBottomColor: colors.border }]}>
        <View style={{ width: 36 }} />
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: F.bold }]}>
          {isEn ? "Checkout" : "الدفع"}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-right" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomInset + 160 }}>

        {/* ── Customer info section ── */}
        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Name row */}
          <View style={styles.listRow}>
            <Text style={[styles.rowValue, { color: colors.foreground, fontFamily: F.semi }]}>
              {user?.name}
            </Text>
            <View style={styles.rowLeft}>
              <Feather name="user" size={16} color={colors.mutedForeground} />
              <Text style={[styles.rowLabel, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                {isEn ? "Name" : "الاسم"}
              </Text>
            </View>
          </View>
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

          {/* Phone row */}
          <View style={styles.listRow}>
            <Text style={[styles.rowValue, { color: colors.foreground, fontFamily: F.semi }]}>
              {user?.phone}
            </Text>
            <View style={styles.rowLeft}>
              <Feather name="phone" size={16} color={colors.mutedForeground} />
              <Text style={[styles.rowLabel, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                {isEn ? "Phone" : "الجوال"}
              </Text>
            </View>
          </View>

          {/* Address row — if available */}
          {user?.address && user.address !== "غير محدد" && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              <View style={styles.listRow}>
                <Text style={[styles.rowValue, { color: colors.foreground, fontFamily: F.semi }]} numberOfLines={1}>
                  {user.address}
                </Text>
                <View style={styles.rowLeft}>
                  <Feather name="map-pin" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.rowLabel, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                    {isEn ? "Address" : "العنوان"}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── Order type (delivery/pickup) ── */}
        {paymentSettings.deliveryEnabled && (
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.listRow}>
              <View style={styles.typeToggle}>
                <TouchableOpacity
                  onPress={() => setOrderType("pickup")}
                  style={[
                    styles.typeBtn,
                    {
                      backgroundColor: orderType === "pickup" ? "#0A2A0A" : colors.secondary,
                      borderColor: orderType === "pickup" ? "#4CAF50" : colors.border,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 20 }}>🏪</Text>
                  <Text style={[styles.typeBtnLabel, { color: orderType === "pickup" ? "#4CAF50" : colors.foreground, fontFamily: F.bold }]}>
                    {isEn ? "Pickup" : "استلام"}
                  </Text>
                  <Text style={[{ color: "#4CAF50", fontFamily: F.semi, fontSize: 11 }]}>
                    {isEn ? "No fee" : "بدون رسوم"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setOrderType("delivery")}
                  style={[
                    styles.typeBtn,
                    {
                      backgroundColor: orderType === "delivery" ? "#2A1A05" : colors.secondary,
                      borderColor: orderType === "delivery" ? GOLD : colors.border,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 20 }}>🚗</Text>
                  <Text style={[styles.typeBtnLabel, { color: orderType === "delivery" ? GOLD : colors.foreground, fontFamily: F.bold }]}>
                    {isEn ? "Delivery" : "توصيل"}
                  </Text>
                  {paymentSettings.deliveryFee > 0 ? (
                    <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11 }}>
                      +{paymentSettings.deliveryFee} {isEn ? "SAR" : "ر.س"}
                    </Text>
                  ) : (
                    <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 11 }}>
                      {isEn ? "Free" : "مجاني"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.rowLeft}>
                <Feather name="truck" size={16} color={colors.mutedForeground} />
                <Text style={[styles.rowLabel, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                  {isEn ? "Order Type" : "نوع الطلب"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Location row ── */}
        {(!paymentSettings.deliveryEnabled || orderType === "delivery") && (
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: locationUrl ? "#2A5A2A" : colors.border }]}>
            {locationUrl ? (
              <>
                <View style={styles.listRow}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => setLocationUrl(null)}
                      style={[styles.locActionBtn, { backgroundColor: "#3A1A1A" }]}
                    >
                      <Feather name="x" size={13} color="#E57373" />
                      <Text style={{ color: "#E57373", fontFamily: F.bold, fontSize: 12 }}>
                        {isEn ? "Remove" : "إزالة"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(locationUrl)}
                      style={[styles.locActionBtn, { backgroundColor: "#1A2A3A" }]}
                    >
                      <Feather name="external-link" size={13} color="#64B5F6" />
                      <Text style={{ color: "#64B5F6", fontFamily: F.bold, fontSize: 12 }}>
                        {isEn ? "View" : "عرض"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.rowLeft}>
                    <Feather name="map-pin" size={16} color="#4CAF50" />
                    <Text style={[styles.rowLabel, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                      {isEn ? "Location" : "الموقع"}
                    </Text>
                  </View>
                </View>
                <View style={[styles.locConfirmed, { backgroundColor: "#1A3A1A" }]}>
                  <Feather name="check-circle" size={14} color="#4CAF50" />
                  <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 13 }}>
                    {isEn ? "Location confirmed ✓" : "تم تحديد موقعك ✓"}
                  </Text>
                </View>
              </>
            ) : (
              <TouchableOpacity
                onPress={handleGetLocation}
                disabled={locationLoading}
                style={styles.listRow}
                activeOpacity={0.7}
              >
                <Text style={[styles.rowValue, { color: locationLoading ? colors.mutedForeground : GOLD, fontFamily: F.bold }]}>
                  {locationLoading
                    ? (isEn ? "Getting location..." : "جاري التحديد...")
                    : (isEn ? "Tap to share location" : "اضغط لمشاركة موقعك")}
                </Text>
                <View style={styles.rowLeft}>
                  {locationLoading
                    ? <ActivityIndicator size="small" color={GOLD} />
                    : <Feather name="map-pin" size={16} color={colors.mutedForeground} />
                  }
                  <Text style={[styles.rowLabel, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                    {isEn ? "Location" : "الموقع"}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Notes row ── */}
        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.listRow}
            onPress={() => setNotesExpanded(!notesExpanded)}
            activeOpacity={0.7}
          >
            <Feather name={notesExpanded ? "chevron-up" : "chevron-left"} size={16} color={colors.mutedForeground} />
            <View style={styles.rowLeft}>
              <Feather name="edit-3" size={16} color={colors.mutedForeground} />
              <Text style={[styles.rowLabel, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                {isEn ? "Notes" : "ملاحظة"}
              </Text>
            </View>
          </TouchableOpacity>
          {notesExpanded && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={isEn ? "Any notes about your order..." : "أي ملاحظات على طلبك..."}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                style={[styles.notesInput, { color: colors.foreground, backgroundColor: colors.secondary, fontFamily: F.regular }]}
                textAlignVertical="top"
              />
            </>
          )}
        </View>

        {/* ── Price breakdown ── */}
        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>
            {isEn ? "Order Summary" : "ملخص الطلب"}
          </Text>

          {/* Items */}
          {items.map((ci) => {
            const lineTotal = ci.item.price * ci.quantity;
            const lineTotalStr = lineTotal % 1 === 0 ? lineTotal.toString() : lineTotal.toFixed(1);
            const name = isEn && ci.item.nameEn ? ci.item.nameEn : ci.item.name;
            return (
              <React.Fragment key={ci.item.id}>
                <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                <View style={styles.listRow}>
                  <Text style={[styles.rowValue, { color: colors.mutedForeground, fontFamily: F.bold }]}>
                    {lineTotalStr} {isEn ? "SAR" : "ر.س"}
                  </Text>
                  <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: F.semi, flex: 1, textAlign: "right" }]} numberOfLines={1}>
                    {name} × {ci.quantity}
                  </Text>
                </View>
              </React.Fragment>
            );
          })}

          {/* Delivery fee */}
          {paymentSettings.deliveryEnabled && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              <View style={styles.listRow}>
                {deliveryFee > 0 ? (
                  <Text style={[styles.rowValue, { color: colors.mutedForeground, fontFamily: F.bold }]}>
                    {deliveryFeeStr} {isEn ? "SAR" : "ر.س"}
                  </Text>
                ) : (
                  <Text style={[styles.rowValue, { color: "#4CAF50", fontFamily: F.bold }]}>
                    {isEn ? "Free" : "مجاني"}
                  </Text>
                )}
                <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: F.semi }]}>
                  {orderType === "delivery"
                    ? (isEn ? "🚗 Delivery" : "🚗 رسوم التوصيل")
                    : (isEn ? "🏪 Branch Pickup" : "🏪 استلام")}
                </Text>
              </View>
            </>
          )}

          {/* Total */}
          <View style={[styles.totalLine, { backgroundColor: colors.border }]} />
          <View style={styles.listRow}>
            <Text style={[styles.grandTotal, { color: GOLD, fontFamily: F.extra }]}>
              {grandTotalStr} {isEn ? "SAR" : "ر.س"}
            </Text>
            <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: F.bold }]}>
              {isEn ? "Total (VAT incl.)" : "المجموع شامل الضريبة"}
            </Text>
          </View>
        </View>

        {/* ── Payment method ── */}
        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>
            {t("paymentMethod")}
          </Text>

          {/* Cash */}
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.listRow} onPress={() => setPaymentMethod("cash")} activeOpacity={0.7}>
            <View style={styles.radioOuter}>
              <View style={[styles.radioInner, { borderColor: paymentMethod === "cash" ? GOLD : colors.border }]}>
                {paymentMethod === "cash" && <View style={[styles.radioDot, { backgroundColor: GOLD }]} />}
              </View>
            </View>
            <View style={styles.rowLeft}>
              <Feather name="dollar-sign" size={16} color={colors.mutedForeground} />
              <View>
                <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: F.bold }]}>
                  {t("cash")}
                </Text>
                <Text style={[{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11 }]}>
                  {t("cashDesc")}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Wallet */}
          {walletBalance !== null && walletBalance > 0 && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.listRow} onPress={() => setPaymentMethod("wallet")} activeOpacity={0.7}>
                <View style={styles.radioOuter}>
                  <View style={[styles.radioInner, { borderColor: paymentMethod === "wallet" ? GOLD : colors.border }]}>
                    {paymentMethod === "wallet" && <View style={[styles.radioDot, { backgroundColor: GOLD }]} />}
                  </View>
                </View>
                <View style={styles.rowLeft}>
                  <Feather name="credit-card" size={16} color={colors.mutedForeground} />
                  <View>
                    <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: F.bold }]}>
                      {t("payWallet")}
                    </Text>
                    <Text style={[{ color: walletBalance >= grandTotal ? "#22C55E" : "#E53935", fontFamily: F.regular, fontSize: 11 }]}>
                      {t("walletBalance")}: {walletBalance} {t("sar")}
                      {walletBalance < grandTotal ? ` (${t("insufficientBalance")})` : ""}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Online / Apple Pay */}
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          {paymentSettings.applePayEnabled ? (
            <TouchableOpacity style={styles.listRow} onPress={() => setPaymentMethod("moyasar")} activeOpacity={0.7}>
              <View style={styles.radioOuter}>
                <View style={[styles.radioInner, { borderColor: paymentMethod === "moyasar" ? GOLD : colors.border }]}>
                  {paymentMethod === "moyasar" && <View style={[styles.radioDot, { backgroundColor: GOLD }]} />}
                </View>
              </View>
              <View style={styles.rowLeft}>
                <Feather name="smartphone" size={16} color={colors.mutedForeground} />
                <View>
                  <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: F.bold }]}>Apple Pay</Text>
                  <Text style={[{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11 }]}>
                    {isEn ? "Pay easily with Apple Pay" : "ادفع بسهولة عبر Apple Pay"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.listRow, { opacity: 0.4 }]}>
              <View style={styles.radioOuter}>
                <View style={[styles.radioInner, { borderColor: colors.border }]} />
              </View>
              <View style={styles.rowLeft}>
                <Feather name="credit-card" size={16} color={colors.mutedForeground} />
                <View>
                  <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: F.bold }]}>
                    💳 {isEn ? "Online Payment (Coming Soon)" : "دفع إلكتروني (قريباً)"}
                  </Text>
                  <Text style={[{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11 }]}>
                    Mada • Visa • Apple Pay • STC Pay
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Bottom submit bar ── */}
      <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomInset + 16 }]}>
        <TouchableOpacity
          onPress={handlePlaceOrder}
          disabled={loading}
          style={[styles.submitBtn, { backgroundColor: GOLD, opacity: loading ? 0.7 : 1 }]}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.submitBtnInner}>
              <Text style={[styles.submitTotal, { fontFamily: F.extra }]}>
                {grandTotalStr} {isEn ? "SAR" : "ر.س"}
              </Text>
              <Text style={[styles.submitText, { fontFamily: F.bold }]}>
                {isEn ? "Place Order" : "إرسال الطلب"}
              </Text>
              <Feather name="check-circle" size={20} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* OTP Overlay */}
      {otpStep === "sent" && (
        <View style={styles.otpOverlay}>
          <View style={[styles.otpSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.otpTitle, { color: GOLD, fontFamily: F.extra }]}>
              📱 {isEn ? "Verify Your Number" : "التحقق من رقمك"}
            </Text>
            <Text style={[styles.otpSubtitle, { color: colors.mutedForeground, fontFamily: F.regular }]}>
              {isEn ? "A 4-digit code was sent to" : "تم إرسال رمز إلى"}{"\n"}
              <Text style={{ color: colors.foreground, fontFamily: F.bold }}>{user?.phone}</Text>
            </Text>
            <TextInput
              value={otpCode}
              onChangeText={(t) => setOtpCode(t.replace(/\D/g, "").slice(0, 4))}
              placeholder="• • • •"
              placeholderTextColor={colors.border}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
              style={[styles.otpInput, { backgroundColor: colors.secondary, color: GOLD, borderColor: otpCode.length === 4 ? GOLD : colors.border }]}
            />
            <TouchableOpacity
              onPress={handleVerifyOtp}
              disabled={otpCode.length !== 4 || otpLoading}
              style={[styles.otpVerifyBtn, { backgroundColor: otpCode.length === 4 ? GOLD : colors.secondary, opacity: otpCode.length === 4 ? 1 : 0.5 }]}
            >
              {otpLoading
                ? <ActivityIndicator color={colors.background} />
                : <Text style={[{ color: colors.background, fontFamily: F.bold, fontSize: 16 }]}>
                    ✅ {isEn ? "Verify & Place Order" : "تحقق وأكمل الطلب"}
                  </Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSendOtp} disabled={otpLoading} style={{ alignItems: "center" }}>
              <Text style={[{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 13 }]}>
                {isEn ? "Didn't receive the code? Resend" : "لم تصلك الرسالة؟ أعد الإرسال"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOtpStep("idle")} style={{ alignItems: "center" }}>
              <Text style={[{ color: colors.destructive, fontFamily: F.regular, fontSize: 13 }]}>
                {isEn ? "Cancel" : "إلغاء"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 20 },

  listCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowLabel: {
    fontSize: 13,
    textAlign: "right",
  },
  rowValue: {
    fontSize: 14,
    textAlign: "left",
  },
  rowDivider: { height: 1 },

  typeToggle: {
    flexDirection: "row",
    gap: 10,
    flex: 1,
  },
  typeBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 12,
    alignItems: "center",
    gap: 4,
  },
  typeBtnLabel: { fontSize: 13 },

  locConfirmed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    padding: 10,
  },
  locActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  notesInput: {
    borderRadius: 0,
    padding: 14,
    fontSize: 14,
    minHeight: 80,
    textAlign: "right",
  },

  sectionLabel: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  totalLine: { height: 1, marginHorizontal: 16, marginVertical: 4 },
  grandTotal: { fontSize: 20 },

  radioOuter: { justifyContent: "center", alignItems: "center" },
  radioInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  submitBtn: {
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 20,
    shadowColor: "#E8920C",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  submitBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  submitTotal: { color: "#FFFFFF", fontSize: 16 },
  submitText: { color: "#FFFFFF", fontSize: 17 },

  otpOverlay: {
    position: "absolute",
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  otpSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  otpTitle: { fontSize: 18, textAlign: "center" },
  otpSubtitle: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  otpInput: {
    borderRadius: 14,
    paddingVertical: 14,
    fontSize: 32,
    textAlign: "center",
    letterSpacing: 16,
    borderWidth: 2,
  },
  otpVerifyBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
});
