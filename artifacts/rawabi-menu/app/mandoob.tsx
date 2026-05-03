import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, StatusBar, Platform, RefreshControl, Image, Alert, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiPost, apiGet, apiPut } from "@/constants/api";
import * as Location from "expo-location";

const F = { regular: "Cairo_400Regular", semi: "Cairo_600SemiBold", bold: "Cairo_700Bold", extra: "Cairo_800ExtraBold" };

interface Driver { id: number; name: string; phone: string; photoUrl: string | null; active: boolean; }
interface OrderItem { id: string; name: string; price: number; quantity: number; }
interface Order { id: number; dailyNumber: number; customerName: string; customerPhone: string; customerAddress: string | null; items: OrderItem[]; totalPrice: number; status: string; notes: string | null; createdAt: string; }
interface Assignment { orderId: number; driverId: number; status: string; assignedAt: string; pickedUpAt: string | null; deliveredAt: string | null; }
interface Row { assignment: Assignment; order: Order | null; }

function LoginScreen({ onLogin }: { onLogin: (driver: Driver) => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!phone.trim() || !pin.trim()) { setError("أدخل رقم الجوال والرقم السري"); return; }
    setLoading(true);
    setError("");
    try {
      const driver = await apiPost<Driver>("/drivers/login", { phone: phone.trim(), pin: pin.trim() });
      onLogin(driver);
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "تعذر تسجيل الدخول");
    }
    setLoading(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? 60 : insets.top }}>
      <StatusBar barStyle="light-content" />
      <TouchableOpacity onPress={() => router.back()} style={{ padding: 16, alignSelf: "flex-end" }}>
        <Feather name="arrow-left" size={22} color={colors.mutedForeground} />
      </TouchableOpacity>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 24 }}>
        <Text style={{ fontSize: 56 }}>🛵</Text>
        <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 26, textAlign: "center" }}>
          بوابة المناديب
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 14, textAlign: "center" }}>
          روابي المندي — دخول المناديب
        </Text>

        <View style={{ width: "100%", gap: 12 }}>
          <TextInput
            value={phone}
            onChangeText={(t) => { setPhone(t); setError(""); }}
            placeholder="رقم الجوال"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, color: colors.foreground, fontFamily: F.bold, fontSize: 16, textAlign: "center", borderWidth: 1, borderColor: colors.border }}
          />
          <TextInput
            value={pin}
            onChangeText={(t) => { setPin(t); setError(""); }}
            placeholder="الرقم السري"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, color: colors.foreground, fontFamily: F.bold, fontSize: 22, textAlign: "center", letterSpacing: 10, borderWidth: 1, borderColor: error ? "#E53935" : colors.border }}
          />
          {error ? <Text style={{ color: "#E53935", fontFamily: F.semi, fontSize: 13, textAlign: "center" }}>{error}</Text> : null}
        </View>

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          style={{ backgroundColor: "#E8920C", borderRadius: 16, paddingVertical: 16, width: "100%", alignItems: "center", opacity: loading ? 0.7 : 1 }}
        >
          {loading ? <ActivityIndicator color="#1A0A00" /> : <Text style={{ color: "#1A0A00", fontFamily: F.extra, fontSize: 17 }}>دخول 🚗</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DriverHome({ driver, onLogout }: { driver: Driver; onLogout: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [pendingDelivery, setPendingDelivery] = useState<{ orderId: number; total: number; customerName: string } | null>(null);
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [activeView, setActiveView] = useState<"orders" | "statement">("orders");

  interface SummaryOrder { orderId: number; dailyNumber: number | null; customerName: string; totalPrice: number; deliveredAt: string | null; }
  interface DailySummary { ordersCount: number; totalCollected: number; orders: SummaryOrder[]; }
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await apiGet<DailySummary>(`/drivers/${driver.id}/daily-summary`);
      setSummary(data);
    } catch {}
    setSummaryLoading(false);
  }, [driver.id]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const trackedOrderRef = useRef<number | null>(null);

  const sendLocation = useCallback(async (orderId: number, lat: number, lng: number) => {
    try { await apiPut(`/orders/${orderId}/driver-location`, { lat, lng }); } catch {}
  }, []);

  const stopGPS = useCallback(() => {
    setSharingLocation(false);
    setLocationError(false);
    trackedOrderRef.current = null;
    if (gpsIntervalRef.current) { clearInterval(gpsIntervalRef.current); gpsIntervalRef.current = null; }
    if (locationSubRef.current) { locationSubRef.current.remove(); locationSubRef.current = null; }
  }, []);

  const startGPS = useCallback(async (orderId: number) => {
    if (trackedOrderRef.current === orderId) return;
    stopGPS();
    trackedOrderRef.current = orderId;
    setLocationError(false);

    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        const onSuccess = (p: GeolocationPosition) => {
          setSharingLocation(true);
          setLocationError(false);
          sendLocation(orderId, p.coords.latitude, p.coords.longitude);
        };
        const onError = () => {
          setSharingLocation(false);
          setLocationError(true);
        };
        const opts: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 };
        navigator.geolocation.getCurrentPosition(onSuccess, onError, opts);
        gpsIntervalRef.current = setInterval(
          () => navigator.geolocation.getCurrentPosition(onSuccess, onError, opts),
          15000,
        );
      } else {
        setLocationError(true);
      }
    } else {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationError(true); return; }
      setSharingLocation(true);
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 50 },
        (loc) => {
          setLocationError(false);
          sendLocation(orderId, loc.coords.latitude, loc.coords.longitude);
        },
      );
      locationSubRef.current = sub;
    }
  }, [sendLocation, stopGPS]);

  useEffect(() => {
    const pickedUp = rows.find(r => r.assignment.status === "picked_up");
    if (pickedUp) {
      startGPS(pickedUp.assignment.orderId);
    } else {
      stopGPS();
    }
  }, [rows, startGPS, stopGPS]);

  useEffect(() => { return () => stopGPS(); }, [stopGPS]);

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiGet<Row[]>(`/drivers/${driver.id}/orders`);
      setRows(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [driver.id]);

  useEffect(() => {
    loadOrders();
    pollRef.current = setInterval(() => loadOrders(true), 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadOrders]);

  const updateStatus = async (orderId: number, status: "picked_up" | "delivered") => {
    setUpdating(orderId);
    try {
      await apiPut(`/orders/${orderId}/driver-status`, { status });
      await loadOrders(true);
    } catch { Alert.alert("خطأ", "تعذّر تحديث الحالة"); }
    setUpdating(null);
  };

  const activeRows = rows.filter((r) => r.assignment.status !== "delivered");
  const doneRows = rows.filter((r) => r.assignment.status === "delivered");

  const statusLabel: Record<string, string> = { assigned: "بانتظار الاستلام", picked_up: "في الطريق 🚗", delivered: "تم التسليم ✅" };
  const statusColor: Record<string, string> = { assigned: "#FB8C00", picked_up: "#43A047", delivered: "#757575" };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? 60 : insets.top }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
            {driver.photoUrl
              ? <Image source={{ uri: driver.photoUrl }} style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: "#E8920C" }} />
              : <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#2A1A08", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#E8920C" }}><Text style={{ fontSize: 20 }}>🛵</Text></View>
            }
            <View>
              <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 15 }}>{driver.name}</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12 }}>{driver.phone}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => { Alert.alert("تسجيل الخروج", "هل تريد الخروج؟", [{ text: "إلغاء", style: "cancel" }, { text: "خروج", style: "destructive", onPress: onLogout }]); }}>
            <Feather name="log-out" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        {sharingLocation && !locationError && (
          <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#1B3A1B", paddingVertical: 6, paddingHorizontal: 14 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#4CAF50" }} />
            <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 12 }}>📡 موقعك يُرسل للعميل</Text>
          </View>
        )}
        {locationError && (
          <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#3A1B1B", paddingVertical: 6, paddingHorizontal: 14 }}>
            <Feather name="alert-circle" size={13} color="#E57373" />
            <Text style={{ color: "#E57373", fontFamily: F.semi, fontSize: 12 }}>تعذّر تحديد موقعك — تحقق من صلاحية الموقع</Text>
          </View>
        )}

        {/* Tab bar */}
        <View style={{ flexDirection: "row-reverse", borderTopWidth: 1, borderTopColor: colors.border }}>
          {([
            { key: "orders",    label: "طلباتي",     icon: "list" },
            { key: "statement", label: "كشف الحساب", icon: "dollar-sign" },
          ] as const).map(tab => {
            const active = activeView === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => {
                  setActiveView(tab.key);
                  if (tab.key === "statement") loadSummary();
                }}
                style={{ flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: active ? "#E8920C" : "transparent" }}
              >
                <Feather name={tab.icon} size={14} color={active ? "#E8920C" : colors.mutedForeground} />
                <Text style={{ color: active ? "#E8920C" : colors.mutedForeground, fontFamily: active ? F.bold : F.regular, fontSize: 13 }}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Cash collection confirmation modal ── */}
      <Modal
        visible={!!pendingDelivery}
        transparent
        animationType="slide"
        onRequestClose={() => setPendingDelivery(null)}
      >
        <View style={{ flex: 1, backgroundColor: "#000000BB", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom + 16, paddingTop: 8 }}>
            {/* Handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 }} />

            {/* Icon */}
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#1A2E1A", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#4CAF5066" }}>
                <Text style={{ fontSize: 40 }}>💵</Text>
              </View>
            </View>

            <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 20, textAlign: "center", marginBottom: 6 }}>
              تأكيد استلام المبلغ
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 14, textAlign: "center", marginBottom: 24, paddingHorizontal: 32 }}>
              قبل تأكيد التسليم، تأكد من استلام المبلغ من العميل
            </Text>

            {/* Amount box */}
            <View style={{ marginHorizontal: 20, backgroundColor: "#0A2A0A", borderRadius: 16, padding: 20, alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#4CAF5033", marginBottom: 20 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 13 }}>
                {pendingDelivery?.customerName}
              </Text>
              <Text style={{ color: "#4CAF50", fontFamily: F.extra, fontSize: 36 }}>
                {pendingDelivery?.total} ر.س
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 12 }}>
                المبلغ المطلوب تحصيله
              </Text>
            </View>

            {/* Checkbox confirm */}
            <TouchableOpacity
              onPress={() => setCashConfirmed(v => !v)}
              style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12, marginHorizontal: 20, marginBottom: 20, backgroundColor: cashConfirmed ? "#1A2E1A" : colors.secondary, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: cashConfirmed ? "#4CAF5066" : colors.border }}
            >
              <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: cashConfirmed ? "#4CAF50" : colors.mutedForeground, backgroundColor: cashConfirmed ? "#4CAF50" : "transparent", alignItems: "center", justifyContent: "center" }}>
                {cashConfirmed && <Feather name="check" size={14} color="#fff" />}
              </View>
              <Text style={{ flex: 1, color: cashConfirmed ? "#4CAF50" : colors.foreground, fontFamily: F.semi, fontSize: 14, textAlign: "right" }}>
                نعم، استلمت المبلغ من العميل ✅
              </Text>
            </TouchableOpacity>

            {/* Confirm button */}
            <TouchableOpacity
              disabled={!cashConfirmed || updating === pendingDelivery?.orderId}
              onPress={async () => {
                if (!pendingDelivery) return;
                await updateStatus(pendingDelivery.orderId, "delivered");
                setPendingDelivery(null);
              }}
              style={{ marginHorizontal: 20, borderRadius: 14, paddingVertical: 15, alignItems: "center", backgroundColor: cashConfirmed ? "#43A047" : colors.secondary, marginBottom: 10 }}
            >
              {updating === pendingDelivery?.orderId
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: cashConfirmed ? "#fff" : colors.mutedForeground, fontFamily: F.extra, fontSize: 16 }}>
                    ✅ تأكيد التسليم
                  </Text>
              }
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              onPress={() => setPendingDelivery(null)}
              style={{ alignItems: "center", paddingVertical: 10 }}
            >
              <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 14 }}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── كشف الحساب view ── */}
      {activeView === "statement" && (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Today's date */}
          <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12, textAlign: "center" }}>
            {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </Text>

          {summaryLoading && <ActivityIndicator color="#E8920C" style={{ marginTop: 30 }} />}

          {!summaryLoading && summary && (<>
            {/* Summary cards */}
            <View style={{ flexDirection: "row-reverse", gap: 12 }}>
              {/* Orders count */}
              <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: "#E8920C44", padding: 16, alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 32, fontFamily: F.extra, color: "#E8920C" }}>{summary.ordersCount}</Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 12, textAlign: "center" }}>طلبات سُلِّمت</Text>
                <Feather name="package" size={18} color="#E8920C" />
              </View>
              {/* Total collected */}
              <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: "#4CAF5044", padding: 16, alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 26, fontFamily: F.extra, color: "#4CAF50" }}>
                  {summary.totalCollected.toFixed(2)}
                </Text>
                <Text style={{ color: "#4CAF50", fontFamily: F.bold, fontSize: 11 }}>ريال</Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 12, textAlign: "center" }}>إجمالي المحصّل</Text>
                <Feather name="dollar-sign" size={18} color="#4CAF50" />
              </View>
            </View>

            {/* Orders list */}
            {summary.orders.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 40, gap: 10 }}>
                <Text style={{ fontSize: 44 }}>📭</Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 14 }}>لا يوجد طلبات مسلّمة اليوم</Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 14, textAlign: "right" }}>تفاصيل الطلبات</Text>
                {summary.orders.map((ord, idx) => {
                  const time = ord.deliveredAt
                    ? new Date(ord.deliveredAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
                    : "--:--";
                  return (
                    <View key={ord.orderId} style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
                      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                        {/* Right: order info */}
                        <View style={{ gap: 3 }}>
                          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                            <View style={{ backgroundColor: "#E8920C22", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                              <Text style={{ color: "#E8920C", fontFamily: F.extra, fontSize: 13 }}>#{ord.dailyNumber ?? ord.orderId}</Text>
                            </View>
                            <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11 }}>الطلب رقم</Text>
                          </View>
                          <Text style={{ color: colors.foreground, fontFamily: F.semi, fontSize: 13 }}>{ord.customerName}</Text>
                          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
                            <Feather name="clock" size={11} color={colors.mutedForeground} />
                            <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11 }}>{time}</Text>
                          </View>
                        </View>
                        {/* Left: amount */}
                        <View style={{ alignItems: "flex-end", gap: 2 }}>
                          <Text style={{ color: "#4CAF50", fontFamily: F.extra, fontSize: 18 }}>{ord.totalPrice.toFixed(2)}</Text>
                          <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 11 }}>ريال</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Refresh button */}
            <TouchableOpacity
              onPress={loadSummary}
              style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginTop: 4 }}
            >
              <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 13 }}>تحديث الكشف</Text>
            </TouchableOpacity>
          </>)}
        </ScrollView>
      )}

      {/* ── Orders view ── */}
      {activeView === "orders" && (
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} tintColor={colors.gold} />}
        contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 60 }}
      >
        {loading && <ActivityIndicator color="#E8920C" style={{ marginTop: 40 }} />}

        {!loading && activeRows.length === 0 && doneRows.length === 0 && (
          <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
            <Text style={{ fontSize: 52 }}>🛵</Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 15, textAlign: "center" }}>لا يوجد طلبات مسندة إليك الآن</Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 13 }}>اسحب للتحديث</Text>
          </View>
        )}

        {activeRows.length > 0 && (
          <Text style={{ color: "#E8920C", fontFamily: F.extra, fontSize: 15, textAlign: "right" }}>🔔 الطلبات النشطة ({activeRows.length})</Text>
        )}

        {activeRows.map(({ assignment, order }) => order && (
          <View key={assignment.orderId} style={{ backgroundColor: colors.card, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
            {/* Status bar */}
            <View style={{ backgroundColor: statusColor[assignment.status] + "22", paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: statusColor[assignment.status] + "44" }}>
              <Text style={{ color: statusColor[assignment.status], fontFamily: F.extra, fontSize: 13 }}>{statusLabel[assignment.status]}</Text>
              <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 14 }}>طلب #{order.dailyNumber}</Text>
            </View>

            <View style={{ padding: 16, gap: 10 }}>
              {/* Customer */}
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                  <Feather name="user" size={14} color={colors.mutedForeground} />
                  <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 14 }}>{order.customerName}</Text>
                </View>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                  <Feather name="phone" size={14} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 13 }}>{order.customerPhone}</Text>
                </View>
                {order.customerAddress && (
                  <TouchableOpacity
                    onPress={() => { const q = encodeURIComponent(order.customerAddress!); if (Platform.OS === "web") window.open(`https://maps.google.com/?q=${q}`); else import("react-native").then(({ Linking }) => Linking.openURL(`https://maps.google.com/?q=${q}`)); }}
                    style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}
                  >
                    <Feather name="map-pin" size={14} color="#4CAF50" />
                    <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 13, flex: 1, textAlign: "right" }} numberOfLines={2}>{order.customerAddress}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Items */}
              <View style={{ backgroundColor: colors.secondary, borderRadius: 10, padding: 10, gap: 4 }}>
                {order.items.map((item, i) => (
                  <View key={i} style={{ flexDirection: "row-reverse", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.foreground, fontFamily: F.semi, fontSize: 13 }}>×{item.quantity} {item.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12 }}>{item.price * item.quantity} ر.س</Text>
                  </View>
                ))}
                <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 }}>
                  <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 14 }}>الإجمالي</Text>
                  <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 14 }}>{(order.totalPrice / 100).toFixed(2)} ر.س</Text>
                </View>
              </View>

              {order.notes && (
                <View style={{ flexDirection: "row-reverse", gap: 8, backgroundColor: "#2A1508", borderRadius: 8, padding: 10 }}>
                  <Text style={{ color: "#E8920C", fontFamily: F.regular, fontSize: 12, flex: 1, textAlign: "right" }}>📝 {order.notes}</Text>
                </View>
              )}

              {/* Action buttons */}
              <View style={{ gap: 8, marginTop: 4 }}>
                {assignment.status === "assigned" && (
                  <TouchableOpacity
                    onPress={() => updateStatus(assignment.orderId, "picked_up")}
                    disabled={updating === assignment.orderId}
                    style={{ backgroundColor: "#FB8C00", borderRadius: 12, paddingVertical: 13, alignItems: "center" }}
                  >
                    {updating === assignment.orderId ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontFamily: F.extra, fontSize: 15 }}>🛵 استلمت الطلب — في الطريق</Text>}
                  </TouchableOpacity>
                )}
                {assignment.status === "picked_up" && (
                  <TouchableOpacity
                    onPress={() => {
                      setCashConfirmed(false);
                      setPendingDelivery({ orderId: assignment.orderId, total: order.totalPrice / 100, customerName: order.customerName });
                    }}
                    disabled={updating === assignment.orderId}
                    style={{ backgroundColor: "#43A047", borderRadius: 12, paddingVertical: 13, alignItems: "center" }}
                  >
                    {updating === assignment.orderId ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontFamily: F.extra, fontSize: 15 }}>✅ تم التسليم للعميل</Text>}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => { const p = order.customerPhone; if (Platform.OS === "web") window.open(`tel:${p}`); else import("react-native").then(({ Linking }) => Linking.openURL(`tel:${p}`)); }}
                  style={{ backgroundColor: colors.secondary, borderRadius: 12, paddingVertical: 11, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: colors.border }}
                >
                  <Feather name="phone" size={15} color="#4CAF50" />
                  <Text style={{ color: "#4CAF50", fontFamily: F.bold, fontSize: 14 }}>اتصال بالعميل</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        {doneRows.length > 0 && (
          <>
            <Text style={{ color: colors.mutedForeground, fontFamily: F.extra, fontSize: 14, textAlign: "right", marginTop: 8 }}>✅ المسلّمة اليوم ({doneRows.length})</Text>
            {doneRows.slice(0, 5).map(({ assignment, order }) => order && (
              <View key={assignment.orderId} style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, opacity: 0.65, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 14 }}>{order.customerName} — طلب #{order.dailyNumber}</Text>
                <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 12 }}>✅ مسلّم</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
      )}
    </View>
  );
}

export default function MandoobScreen() {
  const [driver, setDriver] = useState<Driver | null>(null);
  return driver ? <DriverHome driver={driver} onLogout={() => setDriver(null)} /> : <LoginScreen onLogin={setDriver} />;
}
