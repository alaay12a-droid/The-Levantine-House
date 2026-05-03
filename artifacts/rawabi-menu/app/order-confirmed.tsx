import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Animated,
  Easing,
  Image,
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiGet } from "@/constants/api";
import { useLanguage } from "@/context/LanguageContext";

const F = {
  regular: "Cairo_400Regular",
  semi:    "Cairo_600SemiBold",
  bold:    "Cairo_700Bold",
  extra:   "Cairo_800ExtraBold",
};

type OrderStatus = "pending" | "preparing" | "ready" | "done";
type DriverStatus = "assigned" | "picked_up" | "delivered";

interface Order {
  id: number;
  dailyNumber: number;
  status: OrderStatus;
  createdAt: string;
  notes: string | null;
  customerAddress: string | null;
}

interface AssignmentRow {
  assignment: { driverId: number; status: DriverStatus; assignedAt: string; pickedUpAt: string | null; deliveredAt: string | null };
  driver: { id: number; name: string; phone: string; photoUrl: string | null };
}

const POLL_INTERVAL = 5000;

function usePulse() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.08, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(anim, { toValue: 1,    duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return anim;
}

function useSpin() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.linear })
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
}

/* ─── Status panels ───────────────────────────────────────── */

function StatusPending({ colors, isEn }: { colors: ReturnType<typeof useColors>; isEn: boolean }) {
  const spin = useSpin();
  return (
    <View style={styles.statusWrap}>
      <Animated.View style={{ transform: [{ rotate: spin }], marginBottom: 16 }}>
        <Feather name="clock" size={64} color={colors.mutedForeground} />
      </Animated.View>
      <Text style={[styles.statusTitle, { color: colors.foreground, fontFamily: F.extra }]}>
        {isEn ? "Order Received" : "طلبك في الانتظار"}
      </Text>
      <Text style={[styles.statusDesc, { color: colors.mutedForeground, fontFamily: F.regular }]}>
        {isEn ? "Our team will start preparing it shortly." : "سيبدأ فريقنا بتجهيزه قريباً"}
      </Text>
    </View>
  );
}

function StatusPreparing({ colors, isEn }: { colors: ReturnType<typeof useColors>; isEn: boolean }) {
  const pulse = usePulse();
  return (
    <View style={styles.statusWrap}>
      <Animated.View style={{ transform: [{ scale: pulse }], marginBottom: 16 }}>
        <View style={[styles.iconCircle, { backgroundColor: "#2A3A00", borderColor: "#8BC34A" }]}>
          <Text style={{ fontSize: 52 }}>👨‍🍳</Text>
        </View>
      </Animated.View>
      <Text style={[styles.statusTitle, { color: "#8BC34A", fontFamily: F.extra }]}>
        {isEn ? "Being Prepared" : "طلبك يتجهز"}
      </Text>
      <Text style={[styles.statusDesc, { color: colors.mutedForeground, fontFamily: F.regular }]}>
        {isEn ? "Our team is carefully preparing your order." : "بدأ فريقنا بتجهيز طلبك بعناية"}
      </Text>
    </View>
  );
}

function StatusReady({ colors, isDelivery, isEn }: { colors: ReturnType<typeof useColors>; isDelivery: boolean; isEn: boolean }) {
  const pulse = usePulse();
  return (
    <View style={styles.statusWrap}>
      <Animated.View style={{ transform: [{ scale: pulse }], marginBottom: 16 }}>
        <View style={[styles.iconCircle, { backgroundColor: "#1A2A00", borderColor: colors.gold }]}>
          <Text style={{ fontSize: 52 }}>{isDelivery ? "📦" : "🍽️"}</Text>
        </View>
      </Animated.View>
      <View style={[styles.hotBadge, { backgroundColor: colors.gold }]}>
        <Text style={[styles.hotBadgeText, { fontFamily: F.extra }]}>
          {isEn ? "🔥 Almost Ready" : "🔥 جاري التجهيز"}
        </Text>
      </View>
      <Text style={[styles.statusTitle, { color: colors.gold, fontFamily: F.extra, marginTop: 14 }]}>
        {isDelivery
          ? (isEn ? "Packed & Ready for Pickup" : "طلبك جاهز للاستلام من المندوب")
          : (isEn ? "Your Order is Almost Ready" : "طلبك على وشك يجهز")}
      </Text>
      <Text style={[styles.statusDesc, { color: colors.mutedForeground, fontFamily: F.regular }]}>
        {isDelivery
          ? (isEn ? "A driver will pick it up shortly." : "سيستلمه المندوب قريباً")
          : (isEn ? "Being prepared and almost complete." : "يُجهَّز الآن ويوشك على الاكتمال")}
      </Text>
    </View>
  );
}

function StatusOnTheWay({ colors, isEn }: { colors: ReturnType<typeof useColors>; isEn: boolean }) {
  const pulse = usePulse();
  return (
    <View style={styles.statusWrap}>
      <Animated.View style={{ transform: [{ scale: pulse }], marginBottom: 16 }}>
        <View style={[styles.iconCircle, { backgroundColor: "#0A1F2A", borderColor: "#29B6F6" }]}>
          <Text style={{ fontSize: 52 }}>🛵</Text>
        </View>
      </Animated.View>
      <View style={[styles.hotBadge, { backgroundColor: "#29B6F6" }]}>
        <Text style={[styles.hotBadgeText, { fontFamily: F.extra, color: "#032B3D" }]}>
          {isEn ? "🛵 On the Way!" : "🛵 المندوب في الطريق!"}
        </Text>
      </View>
      <Text style={[styles.statusTitle, { color: "#29B6F6", fontFamily: F.extra, marginTop: 14 }]}>
        {isEn ? "Driver is Heading Your Way" : "المندوب في طريقه إليك"}
      </Text>
      <Text style={[styles.statusDesc, { color: colors.mutedForeground, fontFamily: F.regular }]}>
        {isEn ? "Your order is on its way! Get ready." : "طلبك في الطريق — استعد لاستلامه!"}
      </Text>
    </View>
  );
}

function StatusDone({ colors, onReturn, isEn, isDelivery }: { colors: ReturnType<typeof useColors>; onReturn: () => void; isEn: boolean; isDelivery: boolean }) {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  }, [scale]);
  return (
    <View style={styles.statusWrap}>
      <Animated.View style={{ transform: [{ scale }], marginBottom: 16 }}>
        <View style={[styles.iconCircle, { backgroundColor: "#1A3A1A", borderColor: "#4CAF50" }]}>
          <Feather name="check-circle" size={60} color="#4CAF50" />
        </View>
      </Animated.View>
      <Text style={[styles.statusTitle, { color: "#4CAF50", fontFamily: F.extra }]}>
        {isDelivery
          ? (isEn ? "Delivered Successfully 🎉" : "تم التوصيل بنجاح 🎉")
          : (isEn ? "Order Completed 🎉" : "تم استلام الطلب 🎉")}
      </Text>
      <Text style={[styles.statusDesc, { color: colors.mutedForeground, fontFamily: F.regular }]}>
        {isEn
          ? "Thank you for choosing Rawabi Al-Mandi 🍗\nEnjoy your meal!"
          : "شكراً لاختيارك روابي المندي 🍗\nنتمنى لك وجبة شهية!"}
      </Text>
      <TouchableOpacity
        onPress={onReturn}
        style={[styles.returnBtn, { backgroundColor: colors.gold, marginTop: 28 }]}
        activeOpacity={0.85}
      >
        <Text style={[styles.returnBtnText, { fontFamily: F.bold }]}>
          {isEn ? "Back to Menu" : "العودة للقائمة"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Driver card ─────────────────────────────────────────── */

function DriverCard({ row, colors, isEn }: { row: AssignmentRow; colors: ReturnType<typeof useColors>; isEn: boolean }) {
  const { driver, assignment } = row;
  const driverStatusLabel: Record<DriverStatus, string> = {
    assigned:  isEn ? "Picking up your order" : "يستلم طلبك الآن",
    picked_up: isEn ? "On the way 🚗"         : "في الطريق إليك 🚗",
    delivered: isEn ? "Delivered ✅"           : "تم التسليم ✅",
  };
  const driverStatusColor: Record<DriverStatus, string> = {
    assigned:  "#FB8C00",
    picked_up: "#29B6F6",
    delivered: "#4CAF50",
  };
  const color = driverStatusColor[assignment.status];

  const callDriver = () => {
    const url = `tel:${driver.phone}`;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.open(url);
    } else {
      Linking.openURL(url);
    }
  };

  return (
    <View style={[styles.driverCard, { backgroundColor: color + "14", borderColor: color + "55" }]}>
      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
        {driver.photoUrl
          ? <Image source={{ uri: driver.photoUrl }} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: color }} />
          : (
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: color + "22", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: color }}>
              <Text style={{ fontSize: 26 }}>🛵</Text>
            </View>
          )
        }
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: color, fontFamily: F.bold, fontSize: 15 }}>{driver.name}</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12 }}>
            {driverStatusLabel[assignment.status]}
          </Text>
        </View>
        {assignment.status !== "delivered" && (
          <TouchableOpacity
            onPress={callDriver}
            style={{ backgroundColor: "#4CAF5022", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "#4CAF5055" }}
          >
            <Feather name="phone" size={18} color="#4CAF50" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* ─── Main screen ─────────────────────────────────────────── */

export default function OrderConfirmedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { language } = useLanguage();
  const isEn = language === "en";

  const [status, setStatus]           = useState<OrderStatus>("pending");
  const [dailyNumber, setDailyNumber] = useState<number>(0);
  const [orderDate, setOrderDate]     = useState<string>("");
  const [isDelivery, setIsDelivery]   = useState(false);
  const [assignment, setAssignment]   = useState<AssignmentRow | null>(null);

  const topInset    = Platform.OS === "web" ? 80 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const fetchAll = useCallback(async () => {
    if (!orderId) return;
    try {
      const order = await apiGet<Order>(`/orders/${orderId}`);
      setStatus(order.status);
      if (order.dailyNumber) setDailyNumber(order.dailyNumber);
      if (order.createdAt) {
        const d = new Date(order.createdAt);
        setOrderDate(d.toLocaleDateString(isEn ? "en-US" : "ar-SA", { day: "numeric", month: "long", year: "numeric" }));
      }
      const delivery = !!(
        order.customerAddress ||
        order.notes?.includes("توصيل") ||
        order.notes?.includes("delivery")
      );
      setIsDelivery(delivery);
    } catch {}

    try {
      const row = await apiGet<AssignmentRow | null>(`/orders/${orderId}/assignment`);
      setAssignment(row ?? null);
      if (row) setIsDelivery(true);
    } catch {}
  }, [orderId, isEn]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleReturn = () => {
    if (router.canGoBack()) {
      router.dismissAll();
    } else {
      router.replace("/(tabs)");
    }
  };

  /* ── Effective status for display ── */
  // For delivery orders: after "done" server status, show delivered only when driver delivered
  const driverStatus = assignment?.assignment.status ?? null;
  const effectivelyDelivered = isDelivery && driverStatus === "delivered";
  const onTheWay = isDelivery && driverStatus === "picked_up" && status === "done";

  /* ── Steps ── */
  type StepKey = "pending" | "preparing" | "ready" | "on_the_way" | "delivered" | "done";
  const deliverySteps: { key: StepKey; label: string; labelEn: string; icon: string }[] = [
    { key: "pending",    label: "استلام الطلب",  labelEn: "Received",  icon: "📋" },
    { key: "preparing",  label: "بدء التجهيز",   labelEn: "Preparing", icon: "👨‍🍳" },
    { key: "ready",      label: "جاهز",           labelEn: "Ready",     icon: "📦" },
    { key: "on_the_way", label: "مع المندوب",     labelEn: "On Way",    icon: "🛵" },
    { key: "delivered",  label: "تم التوصيل",    labelEn: "Delivered", icon: "✅" },
  ];
  const pickupSteps: { key: StepKey; label: string; labelEn: string; icon: string }[] = [
    { key: "pending",   label: "استلام الطلب",  labelEn: "Received",   icon: "📋" },
    { key: "preparing", label: "بدء التجهيز",   labelEn: "Preparing",  icon: "👨‍🍳" },
    { key: "ready",     label: "جاري التجهيز",  labelEn: "Almost Ready", icon: "🍽️" },
    { key: "done",      label: "تم الاستلام",   labelEn: "Done",       icon: "✅" },
  ];

  const steps = isDelivery ? deliverySteps : pickupSteps;

  const getCurrentIdx = (): number => {
    if (isDelivery) {
      if (effectivelyDelivered || (status === "done" && !driverStatus)) return 4;
      if (driverStatus === "picked_up") return 3;
      if (driverStatus === "assigned" || status === "done" || status === "ready") return 2;
      if (status === "preparing") return 1;
      return 0;
    }
    return ["pending", "preparing", "ready", "done"].indexOf(status);
  };
  const currentIdx = getCurrentIdx();

  /* ── Which status panel to show ── */
  const showPanel = () => {
    if (isDelivery) {
      if (effectivelyDelivered || (status === "done" && !driverStatus)) return "done";
      if (driverStatus === "picked_up") return "on_the_way";
      return status === "done" ? "ready" : status;
    }
    return status;
  };
  const panel = showPanel();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topInset, paddingBottom: bottomInset }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.gold, fontFamily: F.extra }]}>
          {isEn ? "Track Your Order" : "تتبع طلبك"}
        </Text>
        {dailyNumber > 0 && (
          <Text style={[styles.headerDailyNum, { color: colors.gold, fontFamily: F.bold }]}>
            {isEn ? `Today's Order #${dailyNumber}` : `طلب اليوم #${dailyNumber}`}
          </Text>
        )}
        {orderDate ? (
          <Text style={[styles.headerSub, { color: colors.mutedForeground, fontFamily: F.regular }]}>
            {orderDate}
          </Text>
        ) : null}
        {isDelivery && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, backgroundColor: "#29B6F611", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: "#29B6F633" }}>
            <Text style={{ color: "#29B6F6", fontFamily: F.semi, fontSize: 12 }}>
              🛵 {isEn ? "Delivery Order" : "طلب توصيل"}
            </Text>
          </View>
        )}
      </View>

      {/* Steps bar */}
      <View style={[styles.stepsRow, { paddingHorizontal: isDelivery ? 8 : 16 }]}>
        {steps.map((step, idx) => {
          const done   = idx <= currentIdx;
          const active = idx === currentIdx;
          return (
            <React.Fragment key={step.key}>
              <View style={[styles.stepItem, { width: isDelivery ? 52 : 64 }]}>
                <View style={[
                  styles.stepDot,
                  {
                    width: isDelivery ? 38 : 44, height: isDelivery ? 38 : 44,
                    borderRadius: isDelivery ? 19 : 22,
                    backgroundColor: done ? (active ? colors.gold : "#2A4A2A") : colors.secondary,
                    borderColor:     done ? (active ? colors.gold : "#4CAF50") : colors.border,
                    borderWidth: active ? 3 : 1.5,
                  },
                ]}>
                  <Text style={{ fontSize: isDelivery ? 12 : 14 }}>{step.icon}</Text>
                </View>
                <Text style={[styles.stepLabel, { color: done ? (active ? colors.gold : "#4CAF50") : colors.mutedForeground, fontFamily: active ? F.bold : F.regular }]} numberOfLines={1}>
                  {isEn ? step.labelEn : step.label}
                </Text>
              </View>
              {idx < steps.length - 1 && (
                <View style={[styles.stepLine, { backgroundColor: idx < currentIdx ? "#4CAF50" : colors.border }]} />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Driver card */}
      {assignment && isDelivery && (
        <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
          <DriverCard row={assignment} colors={colors} isEn={isEn} />
        </View>
      )}

      {/* Status panel */}
      <View style={styles.mainArea}>
        {panel === "pending"    && <StatusPending    colors={colors} isEn={isEn} />}
        {panel === "preparing"  && <StatusPreparing  colors={colors} isEn={isEn} />}
        {panel === "ready"      && <StatusReady      colors={colors} isDelivery={isDelivery} isEn={isEn} />}
        {panel === "on_the_way" && <StatusOnTheWay   colors={colors} isEn={isEn} />}
        {panel === "done"       && <StatusDone       colors={colors} onReturn={handleReturn} isEn={isEn} isDelivery={isDelivery} />}
      </View>

      {panel !== "done" && (
        <TouchableOpacity
          onPress={handleReturn}
          style={[styles.backBtn, { borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.backBtnText, { color: colors.mutedForeground, fontFamily: F.semi }]}>
            {isEn ? "Back to Menu" : "العودة للقائمة"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    gap: 4,
  },
  headerTitle:    { fontSize: 22 },
  headerDailyNum: { fontSize: 17, marginTop: 2 },
  headerSub:      { fontSize: 14 },

  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
  },
  stepItem:  { alignItems: "center", gap: 6 },
  stepDot:   { alignItems: "center", justifyContent: "center" },
  stepLabel: { fontSize: 9, textAlign: "center" },
  stepLine:  { flex: 1, height: 3, borderRadius: 2, marginBottom: 18 },

  driverCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 4,
  },

  mainArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  statusWrap: { alignItems: "center", gap: 8 },
  iconCircle: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2,
  },
  statusTitle: { fontSize: 26, textAlign: "center" },
  statusDesc:  { fontSize: 15, textAlign: "center", lineHeight: 26, marginTop: 4 },

  hotBadge:     { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 30, marginTop: 8 },
  hotBadgeText: { color: "#1A1008", fontSize: 17 },

  returnBtn:     { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 20 },
  returnBtnText: { color: "#1A1008", fontSize: 16 },

  backBtn:     { marginHorizontal: 24, marginBottom: 16, paddingVertical: 14, borderRadius: 16, alignItems: "center", borderWidth: 1 },
  backBtnText: { fontSize: 15 },
});
