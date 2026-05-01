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

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

type PaymentMethod = "cash" | "moyasar";

interface Order {
  id: number;
  dailyNumber: number;
  status: string;
}

export default function CheckoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items, totalPrice, totalItems, clearCart } = useCart();
  const { user } = useUser();

  const customerPushToken = useCustomerPushToken();
  const { incrementBadge } = useOrderBadge();
  const { settings: paymentSettings } = usePaymentSettings();

  const [notes, setNotes] = useState("");
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [loading, setLoading] = useState(false);
  const [locationUrl, setLocationUrl] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // SMS OTP
  const [otpStep, setOtpStep] = useState<"idle" | "sent" | "verified">("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  const handleGetLocation = async () => {
    setLocationLoading(true);
    try {
      if (Platform.OS === "web") {
        if (!navigator.geolocation) {
          Alert.alert("غير مدعوم", "متصفحك لا يدعم تحديد الموقع");
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const url = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
            setLocationUrl(url);
            setLocationLoading(false);
          },
          () => {
            Alert.alert("تعذّر التحديد", "يرجى السماح للمتصفح بالوصول للموقع من الإعدادات");
            setLocationLoading(false);
          }
        );
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("الإذن مرفوض", "يرجى السماح للتطبيق بالوصول لموقعك من إعدادات الجهاز");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const url = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
      setLocationUrl(url);
    } catch {
      Alert.alert("خطأ", "تعذّر تحديد الموقع، حاول مرة أخرى");
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
  const totalStr = totalPrice % 1 === 0 ? totalPrice.toString() : totalPrice.toFixed(2);
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
      Alert.alert("خطأ", "تعذر إرسال الرمز، حاول مرة أخرى.");
    } finally {
      setOtpLoading(false);
    }
  };

  const submitOrder = async () => {
    if (!user) return;
    if (paymentMethod === "moyasar") {
      Alert.alert("قريباً", "الدفع الإلكتروني سيكون متاحاً قريباً. يرجى اختيار الدفع عند الاستلام.", [{ text: "حسناً" }]);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(true);
    try {
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
          notes.trim() || null,
        ].filter(Boolean).join(" | ") || null,
        customerPushToken: customerPushToken ?? null,
      });
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
    } catch {
      Alert.alert("خطأ", "تعذر إرسال الطلب، يرجى المحاولة مرة أخرى.");
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
      // auto-submit after successful verification
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

    // Check if SMS OTP is required
    if (otpStep !== "verified") {
      try {
        const smsSettings = await apiGet<{ enabled: boolean }>("/sms-settings");
        if (smsSettings.enabled) {
          await handleSendOtp();
          return; // pause — user must enter OTP first
        }
      } catch {}
    }

    await submitOrder();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { backgroundColor: "#1A1008", paddingTop: topInset + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.secondary }]}
          activeOpacity={0.7}
        >
          <Feather name="arrow-right" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: F.bold }]}>
          إتمام الطلب
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + 200 }]}>

        {/* Customer Info */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.gold, fontFamily: F.bold }]}>
            بيانات العميل
          </Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoValue, { color: colors.foreground, fontFamily: F.semi }]}>
              {user?.name}
            </Text>
            <Feather name="user" size={16} color={colors.mutedForeground} />
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoValue, { color: colors.foreground, fontFamily: F.semi }]}>
              {user?.phone}
            </Text>
            <Feather name="phone" size={16} color={colors.mutedForeground} />
          </View>
          {user?.address && user.address !== "غير محدد" && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoValue, { color: colors.foreground, fontFamily: F.semi }]}>
                {user.address}
              </Text>
              <Feather name="map-pin" size={16} color={colors.mutedForeground} />
            </View>
          )}
        </View>

        {/* Delivery / Pickup Selector */}
        {paymentSettings.deliveryEnabled && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: orderType === "delivery" ? colors.gold : "#2A5A2A" }]}>
            <Text style={[styles.sectionTitle, { color: colors.gold, fontFamily: F.bold }]}>
              نوع الطلب
            </Text>
            <View style={{ flexDirection: "row-reverse", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setOrderType("delivery")}
                activeOpacity={0.8}
                style={{
                  flex: 1, borderRadius: 12, borderWidth: 2, paddingVertical: 14, alignItems: "center", gap: 6,
                  borderColor: orderType === "delivery" ? colors.gold : colors.border,
                  backgroundColor: orderType === "delivery" ? "#2A1A05" : colors.secondary,
                }}
              >
                <Text style={{ fontSize: 26 }}>🚗</Text>
                <Text style={{ color: orderType === "delivery" ? colors.gold : colors.foreground, fontFamily: F.bold, fontSize: 14 }}>توصيل</Text>
                {paymentSettings.deliveryFee > 0 ? (
                  <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11 }}>+{paymentSettings.deliveryFee} ر.س</Text>
                ) : (
                  <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 11 }}>مجاني</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setOrderType("pickup")}
                activeOpacity={0.8}
                style={{
                  flex: 1, borderRadius: 12, borderWidth: 2, paddingVertical: 14, alignItems: "center", gap: 6,
                  borderColor: orderType === "pickup" ? "#4CAF50" : colors.border,
                  backgroundColor: orderType === "pickup" ? "#0A2A0A" : colors.secondary,
                }}
              >
                <Text style={{ fontSize: 26 }}>🏪</Text>
                <Text style={{ color: orderType === "pickup" ? "#4CAF50" : colors.foreground, fontFamily: F.bold, fontSize: 14 }}>استلام من الفرع</Text>
                <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 11 }}>بدون رسوم</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Location */}
        {(!paymentSettings.deliveryEnabled || orderType === "delivery") && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: locationUrl ? "#2A5A2A" : colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.gold, fontFamily: F.bold }]}>
            📍 الموقع (اختياري)
          </Text>

          {locationUrl ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1A3A1A", borderRadius: 10, padding: 12 }}>
                <Feather name="map-pin" size={18} color="#4CAF50" />
                <Text style={{ flex: 1, color: "#4CAF50", fontFamily: F.semi, fontSize: 13 }}>
                  تم تحديد موقعك ✓
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => Linking.openURL(locationUrl)}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#1A2A3A", borderRadius: 10, paddingVertical: 10 }}
                >
                  <Feather name="external-link" size={14} color="#64B5F6" />
                  <Text style={{ color: "#64B5F6", fontFamily: F.bold, fontSize: 13 }}>عرض الموقع</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setLocationUrl(null)}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#3A1A1A", borderRadius: 10, paddingVertical: 10 }}
                >
                  <Feather name="x" size={14} color="#E57373" />
                  <Text style={{ color: "#E57373", fontFamily: F.bold, fontSize: 13 }}>إزالة الموقع</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleGetLocation}
              disabled={locationLoading}
              style={[styles.locationBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
              activeOpacity={0.8}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color={colors.gold} />
              ) : (
                <Feather name="map-pin" size={18} color={colors.gold} />
              )}
              <Text style={[styles.locationBtnText, { color: locationLoading ? colors.mutedForeground : colors.foreground, fontFamily: F.bold }]}>
                {locationLoading ? "جاري تحديد موقعك..." : "تحديد موقعي الحالي 🗺️"}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12, textAlign: "center" }}>
            سيصل رابط موقعك للكاشير مع طلبك
          </Text>
        </View>
        )}

        {/* Order Summary */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.gold, fontFamily: F.bold }]}>
            ملخص الطلب
          </Text>
          {items.map((ci) => {
            const lineTotal = ci.item.price * ci.quantity;
            const lineTotalStr = lineTotal % 1 === 0 ? lineTotal.toString() : lineTotal.toFixed(1);
            return (
              <View key={ci.item.id} style={styles.orderRow}>
                <Text style={[styles.orderPrice, { color: colors.gold, fontFamily: F.bold }]}>
                  {lineTotalStr} ر.س
                </Text>
                <Text style={[styles.orderName, { color: colors.foreground, fontFamily: F.semi }]} numberOfLines={1}>
                  {ci.item.name} × {ci.quantity}
                </Text>
              </View>
            );
          })}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.orderRow}>
            <Text style={[styles.orderPrice, { color: colors.mutedForeground, fontFamily: F.bold }]}>
              {totalStr} ر.س
            </Text>
            <Text style={[styles.orderName, { color: colors.mutedForeground, fontFamily: F.semi }]}>
              المجموع الفرعي ({totalItems} صنف)
            </Text>
          </View>
          {paymentSettings.deliveryEnabled && (
            <View style={styles.orderRow}>
              {deliveryFee > 0 ? (
                <Text style={[styles.orderPrice, { color: colors.gold, fontFamily: F.bold }]}>
                  {deliveryFeeStr} ر.س
                </Text>
              ) : (
                <Text style={[styles.orderPrice, { color: "#4CAF50", fontFamily: F.bold }]}>
                  مجاني
                </Text>
              )}
              <Text style={[styles.orderName, { color: colors.foreground, fontFamily: F.semi }]}>
                {orderType === "delivery" ? "🚗 رسوم التوصيل" : "🏪 استلام من الفرع"}
              </Text>
            </View>
          )}
          <View style={[styles.divider, { backgroundColor: colors.gold, opacity: 0.4 }]} />
          <View style={styles.orderRow}>
            <Text style={[styles.totalPrice, { color: colors.gold, fontFamily: F.extra }]}>
              {grandTotalStr} ر.س
            </Text>
            <Text style={[styles.totalLabel, { color: colors.foreground, fontFamily: F.bold }]}>
              الإجمالي
            </Text>
          </View>
        </View>

        {/* Notes */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.gold, fontFamily: F.bold }]}>
            ملاحظات (اختياري)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="أي ملاحظات على الطلب..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            style={[
              styles.notesInput,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.secondary,
                fontFamily: F.regular,
              },
            ]}
            textAlignVertical="top"
          />
        </View>

        {/* Payment Method */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.gold, fontFamily: F.bold }]}>
            طريقة الدفع
          </Text>

          <TouchableOpacity
            onPress={() => setPaymentMethod("cash")}
            style={[
              styles.paymentOption,
              {
                borderColor: paymentMethod === "cash" ? colors.gold : colors.border,
                backgroundColor: paymentMethod === "cash" ? "#2A1A08" : colors.secondary,
              },
            ]}
            activeOpacity={0.7}
          >
            <View style={[styles.radioOuter, { borderColor: paymentMethod === "cash" ? colors.gold : colors.border }]}>
              {paymentMethod === "cash" && (
                <View style={[styles.radioInner, { backgroundColor: colors.gold }]} />
              )}
            </View>
            <View style={styles.paymentInfo}>
              <Text style={[styles.paymentTitle, { color: colors.foreground, fontFamily: F.bold }]}>
                💵 الدفع عند الاستلام
              </Text>
              <Text style={[styles.paymentDesc, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                ادفع نقداً أو بطاقة عند استلام طلبك
              </Text>
            </View>
          </TouchableOpacity>

          {paymentSettings.applePayEnabled ? (
            <TouchableOpacity
              onPress={() => setPaymentMethod("moyasar")}
              style={[
                styles.paymentOption,
                {
                  borderColor: paymentMethod === "moyasar" ? colors.gold : colors.border,
                  backgroundColor: paymentMethod === "moyasar" ? "#2A1A08" : colors.secondary,
                },
              ]}
              activeOpacity={0.7}
            >
              <View style={[styles.radioOuter, { borderColor: paymentMethod === "moyasar" ? colors.gold : colors.border }]}>
                {paymentMethod === "moyasar" && (
                  <View style={[styles.radioInner, { backgroundColor: colors.gold }]} />
                )}
              </View>
              <View style={styles.paymentInfo}>
                <Text style={[styles.paymentTitle, { color: colors.foreground, fontFamily: F.bold }]}>
                   Apple Pay
                </Text>
                <Text style={[styles.paymentDesc, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                  ادفع بسهولة عبر Apple Pay
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.paymentOption,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.secondary,
                  opacity: 0.45,
                },
              ]}
            >
              <View style={[styles.radioOuter, { borderColor: colors.border }]} />
              <View style={styles.paymentInfo}>
                <Text style={[styles.paymentTitle, { color: colors.foreground, fontFamily: F.bold }]}>
                  💳 دفع إلكتروني (قريباً)
                </Text>
                <Text style={[styles.paymentDesc, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                  مدى • فيزا • Apple Pay • STC Pay
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { backgroundColor: "#1A1008", borderTopColor: colors.border, paddingBottom: bottomInset + 16 }]}>
        <View style={[styles.totalRow, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.bottomTotal, { color: colors.gold, fontFamily: F.extra }]}>
            {grandTotalStr} ر.س
          </Text>
          <Text style={[styles.bottomLabel, { color: colors.mutedForeground, fontFamily: F.regular }]}>
            {paymentSettings.deliveryEnabled
              ? (orderType === "pickup"
                ? "استلام من الفرع"
                : deliveryFee > 0
                  ? `شامل التوصيل ${deliveryFeeStr} ر.س`
                  : "توصيل مجاني")
              : "الإجمالي"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handlePlaceOrder}
          disabled={loading}
          style={[styles.orderBtn, { opacity: loading ? 0.7 : 1 }]}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check-circle" size={20} color="#fff" />
              <Text style={[styles.orderBtnText, { fontFamily: F.bold }]}>إرسال الطلب</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* OTP Verification Overlay */}
      {otpStep === "sent" && (
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, top: 0, backgroundColor: "#000000BB", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#1A1008", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 }}>
            <Text style={{ color: "#FFD700", fontFamily: F.extra, fontSize: 18, textAlign: "center" }}>📱 التحقق من رقمك</Text>
            <Text style={{ color: "#ccc", fontFamily: F.regular, fontSize: 14, textAlign: "center" }}>
              تم إرسال رمز مكون من 4 أرقام إلى{"\n"}
              <Text style={{ color: "#fff", fontFamily: F.bold }}>{user?.phone}</Text>
            </Text>
            <TextInput
              value={otpCode}
              onChangeText={(t) => setOtpCode(t.replace(/\D/g, "").slice(0, 4))}
              placeholder="• • • •"
              placeholderTextColor="#555"
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
              style={{
                backgroundColor: "#2A1A08",
                borderRadius: 14,
                paddingVertical: 14,
                fontSize: 32,
                fontFamily: F.bold,
                color: "#FFD700",
                textAlign: "center",
                letterSpacing: 16,
                borderWidth: 2,
                borderColor: otpCode.length === 4 ? "#FFD700" : "#444",
              }}
            />
            <TouchableOpacity
              onPress={handleVerifyOtp}
              disabled={otpCode.length !== 4 || otpLoading}
              style={{ backgroundColor: otpCode.length === 4 ? "#FFD700" : "#333", borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: otpCode.length === 4 ? 1 : 0.5 }}
            >
              {otpLoading
                ? <ActivityIndicator color="#1A0A00" />
                : <Text style={{ color: "#1A0A00", fontFamily: F.bold, fontSize: 16 }}>✅ تحقق وأكمل الطلب</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSendOtp} disabled={otpLoading} style={{ alignItems: "center" }}>
              <Text style={{ color: "#aaa", fontFamily: F.regular, fontSize: 13 }}>لم تصلك الرسالة؟ أعد الإرسال</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOtpStep("idle")} style={{ alignItems: "center" }}>
              <Text style={{ color: "#E57373", fontFamily: F.regular, fontSize: 13 }}>إلغاء</Text>
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
    textAlign: "center",
  },
  scroll: { padding: 16, gap: 12 },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    textAlign: "right",
  },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  orderName: {
    flex: 1,
    fontSize: 14,
    textAlign: "right",
  },
  orderPrice: {
    fontSize: 14,
    minWidth: 60,
    textAlign: "left",
  },
  divider: { height: 1, marginVertical: 4 },
  totalLabel: { fontSize: 14 },
  totalPrice: { fontSize: 20 },
  notesInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlign: "right",
  },
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    borderStyle: "dashed",
  },
  locationBtnText: { fontSize: 15 },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  paymentInfo: { flex: 1, gap: 3 },
  paymentTitle: { fontSize: 15 },
  paymentDesc: { fontSize: 12 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  bottomTotal: { fontSize: 22 },
  bottomLabel: { fontSize: 13 },
  orderBtn: {
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
  orderBtnText: {
    color: "#fff",
    fontSize: 17,
  },
});
