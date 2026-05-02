import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
import { PhoneAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "@/config/firebase";
import app from "@/config/firebase";

import { useUser } from "@/context/UserContext";

const C = {
  bg: "#0F0A05",
  surface: "#1A1008",
  card: "#231508",
  primary: "#C8171A",
  gold: "#E8920C",
  fg: "#F5ECD7",
  muted: "#8A7560",
  border: "#2E1F0E",
  green: "#1DBF47",
};

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

type Step = "name" | "phone" | "otp" | "location";

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { saveUser } = useUser();
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);

  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [locLoading, setLocLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [verificationId, setVerificationId] = useState<string>("");

  const phoneRef = useRef<TextInput>(null);
  const otpRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);

  const stepIndex = step === "name" ? 0 : step === "phone" ? 1 : step === "otp" ? 2 : 3;

  const formatPhoneNumber = (raw: string) => {
    let num = raw.replace(/\D/g, "");
    if (num.startsWith("0")) num = num.slice(1);
    if (!num.startsWith("966")) num = "966" + num;
    return "+" + num;
  };

  const handleSendOtp = async () => {
    if (phone.trim().length < 9) {
      Alert.alert("", "يرجى إدخال رقم جوال صحيح");
      return;
    }
    setSendingOtp(true);
    try {
      const formattedPhone = formatPhoneNumber(phone.trim());
      const provider = new PhoneAuthProvider(auth);
      const id = await provider.verifyPhoneNumber(
        formattedPhone,
        recaptchaVerifier.current!
      );
      setVerificationId(id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep("otp");
      setTimeout(() => otpRef.current?.focus(), 300);
    } catch (e: any) {
      Alert.alert("خطأ", "تعذر إرسال رمز التحقق. تأكد من الرقم وحاول مجدداً.");
    }
    setSendingOtp(false);
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) {
      Alert.alert("", "يرجى إدخال الرمز المكون من 6 أرقام");
      return;
    }
    setVerifyingOtp(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otp.trim());
      await signInWithCredential(auth, credential);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("location");
      setTimeout(() => addressRef.current?.focus(), 300);
    } catch (e: any) {
      Alert.alert("رمز خاطئ", "الرمز الذي أدخلته غير صحيح. حاول مجدداً.");
    }
    setVerifyingOtp(false);
  };

  const handleNext = () => {
    if (step === "name") {
      if (!name.trim()) { Alert.alert("", "يرجى إدخال اسمك"); return; }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep("phone");
      setTimeout(() => phoneRef.current?.focus(), 300);
    } else if (step === "phone") {
      handleSendOtp();
    } else if (step === "otp") {
      handleVerifyOtp();
    } else {
      if (!address.trim()) { Alert.alert("", "يرجى إدخال عنوانك أو تحديد موقعك"); return; }
      handleSave();
    }
  };

  const handleDetectLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("تنبيه", "لم يتم منح صلاحية الموقع. يمكنك كتابة عنوانك يدوياً.");
        setLocLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(loc.coords.latitude);
      setLng(loc.coords.longitude);
      const geocode = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geocode.length > 0) {
        const g = geocode[0];
        const parts = [g.street, g.district, g.city].filter(Boolean);
        setAddress(parts.join(" - ") || "تم تحديد الموقع");
      } else {
        setAddress("تم تحديد الموقع");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("خطأ", "تعذر تحديد موقعك. يمكنك كتابة عنوانك يدوياً.");
    }
    setLocLoading(false);
  };

  const handleSave = async () => {
    await saveUser({ name: name.trim(), phone: phone.trim(), address: address.trim(), lat, lng });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/(tabs)");
  };

  const steps: { id: Step; icon: string; title: string; subtitle: string }[] = [
    { id: "name",     icon: "user",      title: "ما اسمك؟",            subtitle: "حتى نخاطبك بالاسم في طلبك" },
    { id: "phone",    icon: "phone",     title: "رقم جوالك",           subtitle: "سنرسل لك رمز تحقق عبر SMS" },
    { id: "otp",      icon: "shield",    title: "رمز التحقق",          subtitle: `أرسلنا رمزاً إلى ${phone}` },
    { id: "location", icon: "map-pin",   title: "موقعك أو عنوانك",     subtitle: "لنوصل طلبك بسرعة" },
  ];

  const current = steps[stepIndex];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" />

      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={app.options}
        attemptInvisibleVerification
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <Text style={styles.brandTitle}>روابي المندي</Text>
          <Text style={styles.brandSub}>للمذاق فن وأصول</Text>
        </View>

        <View style={styles.dots}>
          {steps.map((s, i) => (
            <View
              key={s.id}
              style={[
                styles.dot,
                i === stepIndex && styles.dotActive,
                i < stepIndex && styles.dotDone,
              ]}
            />
          ))}
        </View>

        <View style={[styles.card, { borderColor: C.border }]}>
          <View style={[styles.cardAccent, { backgroundColor: C.gold }]} />

          <Image
            source={require("@/assets/images/rawabi_logo.jpg")}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.stepTitle}>{current.title}</Text>
          <Text style={styles.stepSub}>{current.subtitle}</Text>

          {step === "name" && (
            <TextInput
              style={styles.input}
              placeholder="اكتب اسمك هنا"
              placeholderTextColor={C.muted}
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={handleNext}
              textAlign="right"
            />
          )}

          {step === "phone" && (
            <TextInput
              ref={phoneRef}
              style={styles.input}
              placeholder="05XXXXXXXX"
              placeholderTextColor={C.muted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              returnKeyType="next"
              onSubmitEditing={handleNext}
              textAlign="right"
            />
          )}

          {step === "otp" && (
            <View style={{ width: "100%", gap: 12 }}>
              <View style={styles.otpRow}>
                {[0,1,2,3,4,5].map(i => (
                  <View
                    key={i}
                    style={[
                      styles.otpBox,
                      { borderColor: otp.length === i ? C.gold : otp.length > i ? C.green : C.border },
                    ]}
                  >
                    <Text style={[styles.otpChar, { color: C.fg }]}>
                      {otp[i] || ""}
                    </Text>
                  </View>
                ))}
              </View>
              <TextInput
                ref={otpRef}
                style={styles.hiddenInput}
                value={otp}
                onChangeText={v => setOtp(v.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              <TouchableOpacity onPress={handleSendOtp} disabled={sendingOtp}>
                <Text style={[styles.resendText, { color: C.gold }]}>
                  {sendingOtp ? "جاري الإرسال..." : "إعادة إرسال الرمز"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {step === "location" && (
            <View style={styles.locationBlock}>
              <TouchableOpacity
                style={[styles.gpsBtn, { borderColor: C.gold, backgroundColor: C.gold + "18" }]}
                onPress={handleDetectLocation}
                activeOpacity={0.75}
                disabled={locLoading}
              >
                {locLoading ? (
                  <ActivityIndicator color={C.gold} size="small" />
                ) : (
                  <Feather name="crosshair" size={18} color={C.gold} />
                )}
                <Text style={[styles.gpsBtnText, { color: C.gold }]}>
                  {locLoading ? "جاري تحديد الموقع..." : "تحديد موقعي تلقائياً"}
                </Text>
              </TouchableOpacity>

              <View style={styles.orRow}>
                <View style={[styles.orLine, { backgroundColor: C.border }]} />
                <Text style={[styles.orText, { color: C.muted }]}>أو</Text>
                <View style={[styles.orLine, { backgroundColor: C.border }]} />
              </View>

              <TextInput
                ref={addressRef}
                style={[styles.input, styles.addressInput]}
                placeholder="اكتب اسم الحي أو الشارع..."
                placeholderTextColor={C.muted}
                value={address}
                onChangeText={setAddress}
                multiline
                textAlignVertical="top"
                textAlign="right"
                returnKeyType="done"
              />

              {lat && lng && (
                <View style={[styles.locBadge, { backgroundColor: C.green + "22", borderColor: C.green + "44" }]}>
                  <Feather name="check-circle" size={14} color={C.green} />
                  <Text style={[styles.locBadgeText, { color: C.green }]}>تم تحديد الموقع</Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: C.primary, opacity: (sendingOtp || verifyingOtp) ? 0.7 : 1 }]}
            onPress={handleNext}
            activeOpacity={0.85}
            disabled={sendingOtp || verifyingOtp}
          >
            {(sendingOtp || verifyingOtp) ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Text style={styles.nextBtnText}>
                  {step === "location" ? "ابدأ الطلب 🍗" : step === "phone" ? "إرسال رمز التحقق" : step === "otp" ? "تحقق" : "التالي"}
                </Text>
                {step !== "location" && step !== "otp" && (
                  <Feather name="arrow-left" size={18} color="#FFF" />
                )}
              </>
            )}
          </TouchableOpacity>
        </View>

        {step === "location" && (
          <TouchableOpacity onPress={() => { setAddress("غير محدد"); setTimeout(handleSave, 100); }}>
            <Text style={[styles.skipText, { color: C.muted }]}>تخطي الآن وتحديده لاحقاً</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { alignItems: "center", paddingHorizontal: 24, gap: 24 },
  brand: { alignItems: "center", gap: 4 },
  brandTitle: { fontSize: 28, fontFamily: "Cairo_800ExtraBold", color: "#F5ECD7", letterSpacing: 0.5 },
  brandSub: { fontSize: 13, fontFamily: "Cairo_400Regular", color: "#E8920C" },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2E1F0E" },
  dotActive: { backgroundColor: "#C8171A", width: 24 },
  dotDone: { backgroundColor: "#E8920C" },
  card: {
    width: "100%", backgroundColor: "#1A1008", borderRadius: 20, borderWidth: 1,
    overflow: "hidden", alignItems: "center", paddingHorizontal: 24, paddingBottom: 28, gap: 16,
  },
  cardAccent: { width: "100%", height: 4, marginBottom: 8 },
  logo: { width: 160, height: 100, marginBottom: 4 },
  stepTitle: { fontSize: 22, fontFamily: "Cairo_800ExtraBold", color: "#F5ECD7", textAlign: "center" },
  stepSub: { fontSize: 13, fontFamily: "Cairo_400Regular", color: "#8A7560", textAlign: "center", marginTop: -8 },
  input: {
    width: "100%", backgroundColor: "#231508", borderRadius: 12, borderWidth: 1,
    borderColor: "#2E1F0E", paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 17, fontFamily: "Cairo_700Bold", color: "#F5ECD7", textAlign: "right",
  },
  otpRow: { flexDirection: "row", justifyContent: "center", gap: 10, width: "100%" },
  otpBox: {
    width: 44, height: 54, borderRadius: 12, borderWidth: 2,
    backgroundColor: "#231508", alignItems: "center", justifyContent: "center",
  },
  otpChar: { fontSize: 22, fontFamily: "Cairo_700Bold" },
  hiddenInput: { position: "absolute", opacity: 0, width: 1, height: 1 },
  resendText: { fontSize: 13, fontFamily: "Cairo_600SemiBold", textAlign: "center", textDecorationLine: "underline" },
  locationBlock: { width: "100%", gap: 12 },
  gpsBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 14, borderRadius: 12, borderWidth: 1,
  },
  gpsBtnText: { fontSize: 15, fontFamily: "Cairo_700Bold" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 13, fontFamily: "Cairo_400Regular" },
  addressInput: { minHeight: 80, paddingTop: 14 },
  locBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, alignSelf: "flex-start",
  },
  locBadgeText: { fontSize: 12, fontFamily: "Cairo_600SemiBold" },
  nextBtn: {
    width: "100%", flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 10, paddingVertical: 15, borderRadius: 14, marginTop: 4,
  },
  nextBtnText: { fontSize: 17, fontFamily: "Cairo_800ExtraBold", color: "#FFFFFF" },
  skipText: { fontSize: 13, fontFamily: "Cairo_400Regular", textDecorationLine: "underline", marginTop: -8 },
});
