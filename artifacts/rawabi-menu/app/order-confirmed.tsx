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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiGet } from "@/constants/api";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

type OrderStatus = "pending" | "preparing" | "ready" | "done";

interface Order {
  id: number;
  dailyNumber: number;
  status: OrderStatus;
  createdAt: string;
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

function StatusPending({ colors }: { colors: ReturnType<typeof useColors> }) {
  const spin = useSpin();
  return (
    <View style={styles.statusWrap}>
      <Animated.View style={{ transform: [{ rotate: spin }], marginBottom: 16 }}>
        <Feather name="clock" size={64} color={colors.mutedForeground} />
      </Animated.View>
      <Text style={[styles.statusTitle, { color: colors.foreground, fontFamily: F.extra }]}>
        طلبك في الانتظار
      </Text>
      <Text style={[styles.statusDesc, { color: colors.mutedForeground, fontFamily: F.regular }]}>
        سيبدأ فريقنا بتجهيزه قريباً
      </Text>
    </View>
  );
}

function StatusPreparing({ colors }: { colors: ReturnType<typeof useColors> }) {
  const pulse = usePulse();
  return (
    <View style={styles.statusWrap}>
      <Animated.View style={{ transform: [{ scale: pulse }], marginBottom: 16 }}>
        <View style={[styles.iconCircle, { backgroundColor: "#2A3A00", borderColor: "#8BC34A" }]}>
          <Text style={{ fontSize: 52 }}>👨‍🍳</Text>
        </View>
      </Animated.View>
      <Text style={[styles.statusTitle, { color: "#8BC34A", fontFamily: F.extra }]}>
        طلبك يتجهز
      </Text>
      <Text style={[styles.statusDesc, { color: colors.mutedForeground, fontFamily: F.regular }]}>
        بدأ فريقنا بتجهيز طلبك بعناية
      </Text>
    </View>
  );
}

function StatusReady({ colors }: { colors: ReturnType<typeof useColors> }) {
  const pulse = usePulse();
  return (
    <View style={styles.statusWrap}>
      <Animated.View style={{ transform: [{ scale: pulse }], marginBottom: 16 }}>
        <View style={[styles.iconCircle, { backgroundColor: "#1A2A00", borderColor: colors.gold }]}>
          <Text style={{ fontSize: 52 }}>🍽️</Text>
        </View>
      </Animated.View>
      <View style={[styles.hotBadge, { backgroundColor: colors.gold }]}>
        <Text style={[styles.hotBadgeText, { fontFamily: F.extra }]}>🔥 جاري تجهيز الطلب</Text>
      </View>
      <Text style={[styles.statusTitle, { color: colors.gold, fontFamily: F.extra, marginTop: 14 }]}>
        طلبك على وشك يجهز
      </Text>
      <Text style={[styles.statusDesc, { color: colors.mutedForeground, fontFamily: F.regular }]}>
        يُجهَّز الآن ويوشك على الاكتمال
      </Text>
    </View>
  );
}

function StatusDone({ colors, onReturn }: { colors: ReturnType<typeof useColors>; onReturn: () => void }) {
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
        تم استلام الطلب 🎉
      </Text>
      <Text style={[styles.statusDesc, { color: colors.mutedForeground, fontFamily: F.regular }]}>
        شكراً لاختيارك روابي المندي 🍗{"\n"}نتمنى لك وجبة شهية!
      </Text>
      <TouchableOpacity
        onPress={onReturn}
        style={[styles.returnBtn, { backgroundColor: colors.gold, marginTop: 28 }]}
        activeOpacity={0.85}
      >
        <Text style={[styles.returnBtnText, { fontFamily: F.bold }]}>العودة للقائمة</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function OrderConfirmedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [status, setStatus] = useState<OrderStatus>("pending");
  const [dailyNumber, setDailyNumber] = useState<number>(0);
  const [orderDate, setOrderDate] = useState<string>("");
  const topInset = Platform.OS === "web" ? 80 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const fetchStatus = useCallback(async () => {
    if (!orderId) return;
    try {
      const order = await apiGet<Order>(`/orders/${orderId}`);
      setStatus(order.status);
      if (order.dailyNumber) setDailyNumber(order.dailyNumber);
      if (order.createdAt) {
        const d = new Date(order.createdAt);
        setOrderDate(d.toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" }));
      }
    } catch {
    }
  }, [orderId]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleReturn = () => {
    if (router.canGoBack()) {
      router.dismissAll();
    } else {
      router.replace("/(tabs)");
    }
  };

  const steps: { key: OrderStatus; label: string; icon: string }[] = [
    { key: "pending",   label: "استلام الطلب",   icon: "📋" },
    { key: "preparing", label: "بدء التجهيز",    icon: "👨‍🍳" },
    { key: "ready",     label: "جاري التجهيز",   icon: "🍽️" },
    { key: "done",      label: "تم الاستلام",    icon: "✅" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === status);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topInset, paddingBottom: bottomInset }]}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.gold, fontFamily: F.extra }]}>
          تتبع طلبك
        </Text>
        {dailyNumber > 0 && (
          <Text style={[styles.headerDailyNum, { color: colors.gold, fontFamily: F.bold }]}>
            طلب اليوم #{dailyNumber}
          </Text>
        )}
        {orderDate ? (
          <Text style={[styles.headerSub, { color: colors.mutedForeground, fontFamily: F.regular }]}>
            {orderDate}
          </Text>
        ) : null}
      </View>

      <View style={styles.stepsRow}>
        {steps.map((step, idx) => {
          const done = idx <= currentIdx;
          const active = idx === currentIdx;
          return (
            <React.Fragment key={step.key}>
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepDot,
                  {
                    backgroundColor: done ? (active ? colors.gold : "#2A4A2A") : colors.secondary,
                    borderColor: done ? (active ? colors.gold : "#4CAF50") : colors.border,
                    borderWidth: active ? 3 : 1.5,
                  },
                ]}>
                  <Text style={{ fontSize: 14 }}>{step.icon}</Text>
                </View>
                <Text style={[styles.stepLabel, { color: done ? (active ? colors.gold : "#4CAF50") : colors.mutedForeground, fontFamily: active ? F.bold : F.regular }]} numberOfLines={1}>
                  {step.label}
                </Text>
              </View>
              {idx < steps.length - 1 && (
                <View style={[styles.stepLine, { backgroundColor: idx < currentIdx ? "#4CAF50" : colors.border }]} />
              )}
            </React.Fragment>
          );
        })}
      </View>

      <View style={styles.mainArea}>
        {status === "pending"   && <StatusPending   colors={colors} />}
        {status === "preparing" && <StatusPreparing colors={colors} />}
        {status === "ready"     && <StatusReady     colors={colors} />}
        {status === "done"      && <StatusDone      colors={colors} onReturn={handleReturn} />}
      </View>

      {status !== "done" && (
        <TouchableOpacity
          onPress={handleReturn}
          style={[styles.backBtn, { borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.backBtnText, { color: colors.mutedForeground, fontFamily: F.semi }]}>
            العودة للقائمة
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    gap: 4,
  },
  headerTitle: { fontSize: 22 },
  headerDailyNum: { fontSize: 17, marginTop: 2 },
  headerSub: { fontSize: 14 },

  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  stepItem: {
    alignItems: "center",
    gap: 6,
    width: 64,
  },
  stepDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: { fontSize: 10, textAlign: "center" },
  stepLine: { flex: 1, height: 3, borderRadius: 2, marginBottom: 18 },

  mainArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  statusWrap: { alignItems: "center", gap: 8 },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  statusTitle: { fontSize: 26, textAlign: "center" },
  statusDesc: { fontSize: 15, textAlign: "center", lineHeight: 26, marginTop: 4 },

  hotBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    marginTop: 8,
  },
  hotBadgeText: { color: "#1A1008", fontSize: 17 },

  returnBtn: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 20,
  },
  returnBtnText: { color: "#1A1008", fontSize: 16 },

  backBtn: {
    marginHorizontal: 24,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  backBtnText: { fontSize: 15 },
});
