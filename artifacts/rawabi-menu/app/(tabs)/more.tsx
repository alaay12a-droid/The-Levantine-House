import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
  Linking,
  Alert,
  Image,
} from "react-native";

const snapchatLogo = require("@/assets/images/snapchat.jpg");
const tiktokLogo = require("@/assets/images/tiktok.jpg");
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { RESTAURANT_INFO } from "@/constants/menu";
import { useUser } from "@/context/UserContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTranslation } from "@/hooks/useTranslation";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

interface SocialLink {
  image: any;
  label: string;
  url: string;
}

const SOCIAL_LINKS: SocialLink[] = [
  { image: snapchatLogo, label: "سناب شات", url: `https://www.snapchat.com/add/rwabi-almndi?share_id=3Bq3Hx1Ah3o&locale=ar-AE` },
  { image: tiktokLogo,   label: "تيك توك",   url: `https://www.tiktok.com/@rwabialmndi?_r=1&_t=ZS-95zIV9lsc6R` },
];

interface MenuItem {
  icon: string;
  label: string;
  action: () => void;
  danger?: boolean;
}

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, clearUser } = useUser();
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const topInset = Platform.OS === "web" ? 20 : insets.top;

  const handleLogout = () => {
    Alert.alert(
      "مسح البيانات",
      "هل تريد مسح بياناتك الشخصية المحفوظة؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "مسح",
          style: "destructive",
          onPress: () => clearUser(),
        },
      ]
    );
  };

  const menuItems: MenuItem[] = [
    {
      icon: "settings",
      label: "إعدادات التطبيق",
      action: () => router.push("/app-settings" as any),
    },
    {
      icon: "phone",
      label: t("callUs"),
      action: () => Linking.openURL(`tel:${RESTAURANT_INFO.phone}`),
    },
    {
      icon: "message-circle",
      label: t("whatsapp"),
      action: () =>
        Linking.openURL(
          `https://wa.me/${RESTAURANT_INFO.whatsapp}?text=${encodeURIComponent("السلام عليكم، أرغب في الاستفسار")}`
        ),
    },
    {
      icon: "map-pin",
      label: `${t("location")} — ${RESTAURANT_INFO.location}`,
      action: () => Linking.openURL("https://maps.app.goo.gl/DiAZzzLKBAmGNv19A"),
    },
    {
      icon: "info",
      label: t("aboutUs"),
      action: () =>
        Alert.alert(
          "روابي المندي",
          `${RESTAURANT_INFO.tagline}\n\n${RESTAURANT_INFO.location}\nهاتف: ${RESTAURANT_INFO.phone}`
        ),
    },
    {
      icon: "credit-card",
      label: t("paymentMethods"),
      action: () => router.push("/payment-methods" as any),
    },
    {
      icon: "lock",
      label: t("privacy"),
      action: () => Alert.alert("سياسة الخصوصية", "نحرص على حفظ خصوصية بياناتك وعدم مشاركتها مع أطراف ثالثة."),
    },
    {
      icon: "file-text",
      label: t("terms"),
      action: () => router.push("/terms"),
    },
    ...(user
      ? [
          {
            icon: "log-out",
            label: t("clearData"),
            action: handleLogout,
            danger: true,
          } as MenuItem,
        ]
      : []),
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

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
        <Text style={[styles.title, { color: colors.foreground, fontFamily: F.extra }]}>
          {t("more")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Language Toggle */}
        <View style={[styles.langCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>
            {t("language")}
          </Text>
          <View style={[styles.langToggle, { backgroundColor: colors.secondary }]}>
            <TouchableOpacity
              onPress={() => setLanguage("ar")}
              style={[
                styles.langBtn,
                language === "ar" && { backgroundColor: colors.card, elevation: 3 },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.langBtnText, { color: language === "ar" ? colors.foreground : colors.mutedForeground, fontFamily: F.bold }]}>
                العربية
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setLanguage("en")}
              style={[
                styles.langBtn,
                language === "en" && { backgroundColor: colors.card, elevation: 3 },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.langBtnText, { color: language === "en" ? colors.foreground : colors.mutedForeground, fontFamily: F.bold }]}>
                EN
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Wallet Card */}
        {user && (
          <TouchableOpacity
            onPress={() => router.push("/wallet")}
            style={[styles.walletCard, { backgroundColor: "#2A1A0A", borderColor: colors.gold + "60" }]}
            activeOpacity={0.85}
          >
            <Feather name="chevron-left" size={18} color={colors.mutedForeground} />
            <View style={{ flex: 1, alignItems: "flex-end", gap: 3 }}>
              <Text style={[{ fontSize: 17, color: colors.gold, fontFamily: F.bold }]}>
                {t("wallet")}
              </Text>
              <Text style={[{ fontSize: 12, color: colors.mutedForeground, fontFamily: F.regular }]}>
                {t("walletDesc")}
              </Text>
            </View>
            <View style={[styles.walletIcon, { backgroundColor: colors.gold + "22" }]}>
              <Feather name="credit-card" size={24} color={colors.gold} />
            </View>
          </TouchableOpacity>
        )}

        {user && (
          <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
              <Feather name="user" size={28} color={colors.gold} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.foreground, fontFamily: F.bold }]}>
                {user.name}
              </Text>
              <Text style={[styles.profilePhone, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                {user.phone}
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.socialCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>
            {t("contactUs")}
          </Text>
          <View style={styles.socialRow}>
            {SOCIAL_LINKS.map((s, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => Linking.openURL(s.url).catch(() => {})}
                style={styles.socialItem}
              >
                <Image source={s.image} style={styles.socialLogo} resizeMode="cover" />
                <Text style={[styles.socialLabel, { color: colors.foreground, fontFamily: F.bold }]}>
                  {s.label}
                </Text>
                <Text style={[styles.socialHandle, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                  @rawabi-mandi
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {menuItems.map((item, i) => (
            <React.Fragment key={i}>
              <TouchableOpacity
                style={styles.menuRow}
                onPress={item.action}
                activeOpacity={0.7}
              >
                <Feather
                  name={item.icon as any}
                  size={18}
                  color={item.danger ? colors.destructive : colors.gold}
                />
                <Text
                  style={[
                    styles.menuLabel,
                    {
                      color: item.danger ? colors.destructive : colors.foreground,
                      fontFamily: F.semi,
                    },
                  ]}
                >
                  {item.label}
                </Text>
                <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              {i < menuItems.length - 1 && (
                <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground, fontFamily: F.regular }]}>
          روابي المندي • نسخة 1.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  title: { fontSize: 20 },
  profileCard: {
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: { flex: 1, alignItems: "flex-end" },
  profileName: { fontSize: 17 },
  profilePhone: { fontSize: 14, marginTop: 2 },
  socialCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionLabel: { fontSize: 13, textAlign: "right" },
  socialRow: {
    flexDirection: "row-reverse",
    gap: 20,
  },
  socialItem: {
    alignItems: "center",
    gap: 6,
  },
  socialLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  socialLabel: { fontSize: 13 },
  socialHandle: { fontSize: 11 },
  menuCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 12,
  },
  menuLabel: { flex: 1, fontSize: 15, textAlign: "right" },
  rowDivider: { height: 1, marginHorizontal: 16 },
  version: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 24,
    marginBottom: 8,
  },
  langCard: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  langToggle: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  langBtnText: { fontSize: 15 },
  walletCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
  },
  walletIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
});
