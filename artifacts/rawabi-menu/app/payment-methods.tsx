import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  StatusBar,
  Animated,
  KeyboardAvoidingView,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/hooks/useTranslation";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

const CARDS_KEY = "@rawabi_saved_cards";

interface SavedCard {
  id: string;
  number: string;
  expiry: string;
  cvv: string;
}

function maskCard(num: string) {
  const clean = num.replace(/\s/g, "");
  if (clean.length < 4) return num;
  return "**** **** **** " + clean.slice(-4);
}

function formatCardNumber(val: string) {
  const digits = val.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(val: string) {
  const digits = val.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits;
}

function getCardType(num: string) {
  const n = num.replace(/\s/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^6/.test(n)) return "mada";
  return "generic";
}

function CardIcon({ type, size = 28 }: { type: string; size?: number }) {
  const color = type === "visa" ? "#1A1F71" : type === "mastercard" ? "#EB001B" : "#C79B3B";
  const label = type === "visa" ? "VISA" : type === "mastercard" ? "MC" : type === "mada" ? "مدى" : type === "amex" ? "AMEX" : "💳";
  return (
    <View style={{ width: size + 12, height: size - 4, borderRadius: 6, backgroundColor: color + "22", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: color + "55" }}>
      <Text style={{ color, fontFamily: F.bold, fontSize: size * 0.38 }}>{label}</Text>
    </View>
  );
}

export default function PaymentMethodsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [cards, setCards] = useState<SavedCard[]>([]);
  const [showSheet, setShowSheet] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [saving, setSaving] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(CARDS_KEY).then((val) => {
      if (val) setCards(JSON.parse(val));
    });
  }, []);

  const openSheet = () => {
    setCardNumber("");
    setExpiry("");
    setCvv("");
    setShowSheet(true);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setShowSheet(false));
  };

  const handleSave = async () => {
    const digits = cardNumber.replace(/\s/g, "");
    if (digits.length < 13) {
      Alert.alert("خطأ", "رقم البطاقة غير صحيح");
      return;
    }
    if (!expiry || expiry.length < 5) {
      Alert.alert("خطأ", "تاريخ الانتهاء غير صحيح");
      return;
    }
    if (!cvv || cvv.length < 3) {
      Alert.alert("خطأ", "رمز CVV غير صحيح");
      return;
    }
    setSaving(true);
    const newCard: SavedCard = {
      id: Date.now().toString(),
      number: cardNumber,
      expiry,
      cvv,
    };
    const updated = [...cards, newCard];
    await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(updated));
    setCards(updated);
    setSaving(false);
    closeSheet();
  };

  const handleDelete = (id: string) => {
    Alert.alert("حذف البطاقة", "هل تريد حذف هذه البطاقة؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          const updated = cards.filter((c) => c.id !== id);
          await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(updated));
          setCards(updated);
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-right" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: F.extra }]}>
          طرق الدفع
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 100, gap: 14 }}>
        {cards.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather name="credit-card" size={52} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: F.semi }]}>
              لا يوجد طرق دفع
            </Text>
          </View>
        ) : (
          cards.map((card) => {
            const type = getCardType(card.number);
            return (
              <View key={card.id} style={[styles.cardRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TouchableOpacity onPress={() => handleDelete(card.id)} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: "flex-end", gap: 4 }}>
                  <Text style={[styles.cardNum, { color: colors.foreground, fontFamily: F.bold }]}>
                    {maskCard(card.number)}
                  </Text>
                  <Text style={[styles.cardExpiry, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                    ينتهي {card.expiry}
                  </Text>
                </View>
                <CardIcon type={type} size={32} />
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Floating Add Button */}
      <View style={[styles.fabWrap, { paddingBottom: bottomInset + 12 }]}>
        <TouchableOpacity
          onPress={openSheet}
          style={[styles.fab, { backgroundColor: colors.gold }]}
          activeOpacity={0.85}
        >
          <Text style={[styles.fabText, { color: "#1A0A00", fontFamily: F.bold }]}>
            ادخل بيانات البطاقة
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet */}
      {showSheet && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fadeAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                paddingBottom: bottomInset + 20,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

              <Text style={[styles.sheetTitle, { color: colors.foreground, fontFamily: F.extra }]}>
                طرق الدفع
              </Text>

              {/* Card Number */}
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>
                رقم البطاقة
              </Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                {cardNumber.length > 0 && (
                  <CardIcon type={getCardType(cardNumber)} size={22} />
                )}
                <TextInput
                  value={cardNumber}
                  onChangeText={(v) => setCardNumber(formatCardNumber(v))}
                  placeholder="0000 0000 0000 0000"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  maxLength={19}
                  style={[styles.inputField, { color: colors.foreground, fontFamily: F.bold, textAlign: "right" }]}
                />
              </View>

              {/* Expiry + CVV */}
              <View style={{ flexDirection: "row-reverse", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>
                    MM/YY
                  </Text>
                  <TextInput
                    value={expiry}
                    onChangeText={(v) => setExpiry(formatExpiry(v))}
                    placeholder="MM/YY"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    maxLength={5}
                    style={[styles.input, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground, fontFamily: F.bold, textAlign: "center" }]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>
                    CVV
                  </Text>
                  <TextInput
                    value={cvv}
                    onChangeText={(v) => setCvv(v.replace(/\D/g, "").slice(0, 4))}
                    placeholder="•••"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                    style={[styles.input, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground, fontFamily: F.bold, textAlign: "center" }]}
                  />
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={[styles.saveBtn, { backgroundColor: colors.gold, marginTop: 20 }]}
                activeOpacity={0.85}
              >
                <Text style={[styles.saveBtnText, { color: "#1A0A00", fontFamily: F.bold }]}>
                  حفظ
                </Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 20 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 14 },
  emptyText: { fontSize: 16 },
  cardRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  cardNum: { fontSize: 16, letterSpacing: 2 },
  cardExpiry: { fontSize: 13 },
  deleteBtn: { padding: 6 },
  fabWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
  },
  fab: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  fabText: { fontSize: 16 },
  backdrop: { backgroundColor: "#000000AA" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 0,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 20, textAlign: "right", marginBottom: 20 },
  fieldLabel: { fontSize: 13, textAlign: "right", marginBottom: 6, marginTop: 10 },
  inputWrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 4,
  },
  inputField: { flex: 1, paddingVertical: 13, fontSize: 16 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnText: { fontSize: 16 },
});
