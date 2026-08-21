import React from "react";
import { Linking, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

const PUBLIC_PRIVACY_URL = "https://jolly-pasca-488d71.netlify.app";

const sections = [
  {
    ar: "البيانات التي نجمعها",
    en: "Data We Collect",
    bodyAr:
      "قد نجمع الاسم ورقم الهاتف والعنوان وبيانات الطلب اللازمة لتقديم خدمات البيت الشامي. لا نطلب بيانات لا نحتاجها لتشغيل الخدمة.",
    bodyEn:
      "We may collect your name, phone number, address, and order details needed to provide The Levantine House services. We do not request data that is not needed to operate the service.",
  },
  {
    ar: "استخدام البيانات",
    en: "How We Use Data",
    bodyAr:
      "نستخدم البيانات لمعالجة الطلبات والتوصيل والتواصل معك بشأن طلبك وتحسين تجربة التطبيق. لا نبيع بياناتك ولا نستخدمها لأغراض إعلانية غير مرتبطة بالخدمة.",
    bodyEn:
      "We use data to process orders, arrange delivery, contact you about your order, and improve the app experience. We do not sell your data or use it for unrelated advertising.",
  },
  {
    ar: "بيانات الموقع",
    en: "Location Data",
    bodyAr:
      "يتم استخدام الموقع فقط عندما تختار ميزة تحديد العنوان أو عندما يوافق المندوب صراحة على مشاركة موقعه لتنفيذ طلب توصيل نشط.",
    bodyEn:
      "Location is used only when you choose address detection, or when a driver explicitly consents to sharing location while completing an active delivery.",
  },
  {
    ar: "الحماية والاحتفاظ",
    en: "Protection and Retention",
    bodyAr:
      "نحمي البيانات عبر اتصال مشفّر ونحتفظ بها للمدة اللازمة لتقديم الخدمة والالتزام بالمتطلبات النظامية. الوصول إليها مقيّد بالمصرح لهم.",
    bodyEn:
      "We protect data using encrypted connections and retain it only as long as needed to provide the service and meet legal requirements. Access is restricted to authorized staff.",
  },
  {
    ar: "حقوقك",
    en: "Your Rights",
    bodyAr:
      "يمكنك طلب الوصول إلى بياناتك أو تصحيحها أو حذفها، كما يمكنك سحب أذونات الموقع من إعدادات جهازك. للتواصل حول الخصوصية والبيانات: alaay12a@gmail.com أو واتساب 0582011329.",
    bodyEn:
      "You may request access to, correction of, or deletion of your data, and you can revoke location permissions from your device settings. For privacy and data questions, contact alaay12a@gmail.com or WhatsApp +966 58 201 1329.",
  },
];

export default function PrivacyPolicy() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { language } = useLanguage();
  const isEn = language === "en";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.secondary }]}
          accessibilityLabel={isEn ? "Back" : "رجوع"}
        >
          <Feather name={isEn ? "arrow-left" : "arrow-right"} size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: F.extra }]}>
            {isEn ? "Privacy Policy" : "سياسة الخصوصية"}
          </Text>
          <Text style={[styles.headerSub, { color: colors.gold, fontFamily: F.bold }]}>
            {isEn ? "The Levantine House" : "البيت الشامي"}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.intro, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.introTitle, { color: colors.gold, fontFamily: F.bold }]}>
            {isEn ? "Last updated: August 2026" : "آخر تحديث: أغسطس 2026"}
          </Text>
          <Text style={[styles.body, { color: colors.foreground, fontFamily: F.semi }]}>
            {isEn
              ? "The Levantine House respects your privacy and handles personal data in accordance with applicable Saudi regulations."
              : "يحترم البيت الشامي خصوصيتك ويتعامل مع بياناتك الشخصية وفق الأنظمة المعمول بها في المملكة العربية السعودية."}
          </Text>
        </View>

        {sections.map((section, index) => (
          <View key={section.en} style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeading}>
              <View style={[styles.number, { backgroundColor: colors.gold + "22", borderColor: colors.gold + "55" }]}>
                <Text style={[styles.numberText, { color: colors.gold, fontFamily: F.bold }]}>{index + 1}</Text>
              </View>
              <Text style={[styles.sectionTitle, { color: colors.gold, fontFamily: F.bold }]}>
                {isEn ? section.en : section.ar}
              </Text>
            </View>
            <Text style={[styles.body, { color: colors.foreground, fontFamily: F.regular }]}>
              {isEn ? section.bodyEn : section.bodyAr}
            </Text>
          </View>
        ))}

        <Text style={[styles.footer, { color: colors.mutedForeground, fontFamily: F.regular }]}>
          {isEn ? "The Levantine House — All rights reserved © 2026" : "البيت الشامي — جميع الحقوق محفوظة © 2026"}
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL(PUBLIC_PRIVACY_URL)}
          accessibilityRole="link"
          accessibilityLabel={isEn ? "Open full privacy policy online" : "فتح سياسة الخصوصية الكاملة"}
          style={styles.publicLink}
        >
          <Text style={[styles.publicLinkText, { color: colors.gold, fontFamily: F.semi }]}>
            {isEn ? "View the full privacy policy online" : "عرض سياسة الخصوصية الكاملة على الويب"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    minHeight: 82,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerCenter: { alignItems: "center", flex: 1 },
  headerTitle: { fontSize: 18 },
  headerSub: { fontSize: 12, marginTop: 2 },
  intro: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  introTitle: { fontSize: 13, marginBottom: 8, textAlign: "right" },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  sectionHeading: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 10 },
  number: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  numberText: { fontSize: 13 },
  sectionTitle: { fontSize: 15, flex: 1, textAlign: "right" },
  body: { fontSize: 13, lineHeight: 24, textAlign: "right" },
  footer: { textAlign: "center", fontSize: 12, marginTop: 10 },
  publicLink: { alignSelf: "center", marginTop: 12, padding: 6 },
  publicLinkText: { fontSize: 13, textDecorationLine: "underline" },
});