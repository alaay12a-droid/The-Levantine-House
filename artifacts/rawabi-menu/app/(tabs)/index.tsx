import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Image,
  TouchableOpacity,
  StatusBar,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { FOOD_IMAGES, MENU_CATEGORIES, RESTAURANT_INFO } from "@/constants/menu";
import { MenuItemCard } from "@/components/MenuItemCard";
import { CartBar } from "@/components/CartBar";

const logo = require("@/assets/images/logo.png");
const deliveryCar = require("@/assets/images/delivery_car.jpg");
const dhabihaImg = require("@/assets/images/dhabiha.png");
const dhabihaPoster = require("@/assets/images/dhabiha_poster.jpg");

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

export default function MenuScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState(MENU_CATEGORIES[0].id);

  const activeCat = MENU_CATEGORIES.find((c) => c.id === activeCategory);
  const topInset = Platform.OS === "web" ? 60 : insets.top;

  const handleWhatsApp = (msg: string) => {
    Linking.openURL(`https://wa.me/${RESTAURANT_INFO.whatsapp}?text=${encodeURIComponent(msg)}`);
  };

  const handleCall = () => {
    Linking.openURL(`tel:${RESTAURANT_INFO.phone}`);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: topInset }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={handleCall}
            style={[styles.phoneBtn, { backgroundColor: "#2A1508" }]}
          >
            <Feather name="phone" size={18} color={colors.gold} />
          </TouchableOpacity>

          <View style={styles.titleBlock}>
            <Text style={[styles.brandName, { fontFamily: F.extra }]}>روابي المندي</Text>
            <Text style={[styles.tagline, { color: colors.gold, fontFamily: F.semi }]}>
              للمذاق فن وأصول
            </Text>
          </View>

          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </View>

        {/* ── CATEGORY TABS ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
          style={styles.tabsScroll}
        >
          {MENU_CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setActiveCategory(cat.id)}
                activeOpacity={0.75}
                style={[
                  styles.tab,
                  active
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: "#1A1008", borderColor: "#3A2410" },
                ]}
              >
                <Text style={styles.tabIcon}>{cat.icon}</Text>
                <Text style={[styles.tabLabel, { color: active ? "#fff" : colors.mutedForeground, fontFamily: F.bold }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── CONTENT ── */}
      {activeCat?.isDelivery ? (
        /* ── DELIVERY SECTION ── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          <View style={[styles.deliveryCard, { backgroundColor: colors.card, borderColor: colors.gold }]}>
            <Image source={deliveryCar} style={styles.carImage} resizeMode="cover" />
            <View style={[styles.deliveryOverlay, { backgroundColor: "#0F0A05EE" }]}>
              <Text style={[styles.deliveryTitle, { color: colors.gold, fontFamily: F.extra }]}>خدمة التوصيل</Text>
              <Text style={[styles.deliverySubtitle, { color: colors.foreground, fontFamily: F.bold }]}>
                نوصل طلبك لباب بيتك
              </Text>
              <Text style={[styles.deliveryLocation, { color: colors.mutedForeground, fontFamily: F.semi }]}>
                📍 تبوك - حي الروضة وما حولها
              </Text>

              <View style={styles.deliveryBtns}>
                <TouchableOpacity
                  onPress={() => handleWhatsApp("السلام عليكم، أرغب في طلب توصيل")}
                  style={[styles.deliveryBtn, { backgroundColor: "#1DBF47" }]}
                >
                  <Feather name="message-circle" size={18} color="#fff" />
                  <Text style={[styles.deliveryBtnText, { fontFamily: F.bold }]}>اطلب توصيل واتساب</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCall}
                  style={[styles.deliveryBtn, { backgroundColor: colors.primary }]}
                >
                  <Feather name="phone" size={18} color="#fff" />
                  <Text style={[styles.deliveryBtnText, { fontFamily: F.bold }]}>{RESTAURANT_INFO.phone}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      ) : activeCat?.isDhabiha ? (
        /* ── DHABIHA SECTION ── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          <View style={[styles.dhabihaHero, { borderColor: "#E8920C" }]}>
            <Image source={dhabihaPoster} style={styles.dhabihaImg} resizeMode="cover" />
          </View>

          {activeCat.items.map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))}

          <View style={[styles.bookBox, { backgroundColor: "#1F130A", borderColor: "#E8920C" }]}>
            <Text style={[styles.bookTitle, { color: colors.gold, fontFamily: F.extra }]}>حجز الذبائح</Text>
            <Text style={[styles.bookDesc, { color: colors.mutedForeground, fontFamily: F.regular }]}>
              للحجز والاستفسار عن الأسعار تواصل معنا مباشرة
            </Text>
            <View style={styles.bookBtns}>
              <TouchableOpacity
                onPress={() => handleWhatsApp("السلام عليكم، أرغب في الاستفسار عن ذبائح العيد والأسعار")}
                style={[styles.bookBtn, { backgroundColor: "#1DBF47" }]}
              >
                <Feather name="message-circle" size={16} color="#fff" />
                <Text style={[styles.bookBtnText, { fontFamily: F.bold }]}>واتساب</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCall}
                style={[styles.bookBtn, { backgroundColor: colors.primary }]}
              >
                <Feather name="phone" size={16} color="#fff" />
                <Text style={[styles.bookBtnText, { fontFamily: F.bold }]}>اتصل الآن</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : activeCat?.isOccasions ? (
        /* ── OCCASIONS SECTION ── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          <View style={[styles.occasionsHeader, { backgroundColor: "#1A0D00", borderColor: colors.gold }]}>
            <Text style={[styles.occasionsTitle, { color: colors.gold, fontFamily: F.extra }]}>🎉 عروض المناسبات</Text>
            <Text style={[styles.occasionsSub, { color: colors.mutedForeground, fontFamily: F.semi }]}>
              عروض خاصة لكل مناسبة — تواصل معنا لمعرفة التفاصيل
            </Text>
          </View>

          {activeCat.items.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.85}
              onPress={() => handleWhatsApp(`السلام عليكم، أرغب في الاستفسار عن: ${item.name}`)}
              style={[styles.occasionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {FOOD_IMAGES[item.imageKey ?? ""] && (
                <Image
                  source={FOOD_IMAGES[item.imageKey!]}
                  style={styles.occasionImg}
                  resizeMode="cover"
                />
              )}
              <View style={[styles.occasionOverlay, { backgroundColor: "#0F0A05CC" }]}>
                <View style={[styles.occasionBadge, { backgroundColor: colors.gold }]}>
                  <Text style={[styles.occasionBadgeText, { fontFamily: F.bold }]}>عرض خاص</Text>
                </View>
                <Text style={[styles.occasionName, { color: "#FFFFFF", fontFamily: F.extra }]}>{item.name}</Text>
                <Text style={[styles.occasionDesc, { color: "#FFFFFF99", fontFamily: F.semi }]}>{item.description}</Text>
                <View style={[styles.occasionBtn, { backgroundColor: "#1DBF47" }]}>
                  <Feather name="message-circle" size={15} color="#fff" />
                  <Text style={[styles.occasionBtnText, { fontFamily: F.bold }]}>استفسر عبر واتساب</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        /* ── REGULAR MENU SECTION ── */
        <>
          <View style={[styles.sectionRow, { borderBottomColor: "#2A1A0A" }]}>
            <Text style={[styles.itemCount, { color: colors.mutedForeground, fontFamily: F.semi }]}>
              {activeCat?.items.length ?? 0} أصناف
            </Text>
            <View style={styles.sectionTitle}>
              <Text style={[styles.sectionName, { color: colors.foreground, fontFamily: F.extra }]}>
                {activeCat?.name}
              </Text>
              <Text style={styles.sectionIcon}>{activeCat?.icon}</Text>
            </View>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.list,
              { paddingBottom: Platform.OS === "web" ? 130 : 110 },
            ]}
          >
            {activeCat?.items.map((item) => (
              <MenuItemCard key={item.id} item={item} />
            ))}
          </ScrollView>
        </>
      )}

      <CartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    backgroundColor: "#130B04",
    borderBottomWidth: 1,
    borderBottomColor: "#2A1A0A",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 10,
    gap: 12,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1F130A",
  },
  titleBlock: {
    flex: 1,
    alignItems: "flex-end",
  },
  brandName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "right",
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    marginTop: 3,
    letterSpacing: 0.5,
  },
  phoneBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsScroll: { paddingBottom: 14 },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
    marginLeft: 4,
  },
  tabIcon: { fontSize: 15, fontFamily: Platform.OS === "web" ? "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif" : undefined },
  tabLabel: { fontSize: 13 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    backgroundColor: "#0F0A05",
  },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionName: { fontSize: 18 },
  sectionIcon: { fontSize: 20, fontFamily: Platform.OS === "web" ? "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif" : undefined },
  itemCount: { fontSize: 13 },
  list: { padding: 14 },

  /* Delivery */
  deliveryCard: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.5,
    marginBottom: 16,
  },
  carImage: { width: "100%", height: 200 },
  deliveryOverlay: {
    padding: 20,
    gap: 10,
  },
  deliveryTitle: { fontSize: 26, textAlign: "right" },
  deliverySubtitle: { fontSize: 16, textAlign: "right" },
  deliveryLocation: { fontSize: 14, textAlign: "right", marginBottom: 6 },
  deliveryBtns: { gap: 10, marginTop: 6 },
  deliveryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
  },
  deliveryBtnText: { color: "#fff", fontSize: 16 },

  /* Dhabiha */
  dhabihaHero: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    marginBottom: 14,
  },
  dhabihaImg: {
    width: "100%",
    height: 480,
  },
  dhabihaOverlay: {
    padding: 18,
    gap: 6,
    alignItems: "flex-end",
  },
  dhabihaTagBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  dhabihaTagText: { color: "#fff", fontSize: 13 },
  dhabihaHeroTitle: { fontSize: 22, textAlign: "right" },
  dhabihaHeroSub: { fontSize: 15, textAlign: "right" },
  bookBox: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 18,
    gap: 8,
    marginTop: 6,
    alignItems: "flex-end",
  },
  bookTitle: { fontSize: 20 },
  bookDesc: { fontSize: 14, textAlign: "right", lineHeight: 22 },
  bookBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    width: "100%",
  },
  bookBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  bookBtnText: { color: "#fff", fontSize: 15 },

  /* Occasions */
  occasionsHeader: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 18,
    alignItems: "center",
    marginBottom: 14,
    gap: 6,
  },
  occasionsTitle: { fontSize: 22, textAlign: "center" },
  occasionsSub: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  occasionCard: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    overflow: "hidden",
    height: 200,
  },
  occasionImg: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  occasionOverlay: {
    flex: 1,
    padding: 16,
    justifyContent: "flex-end",
    gap: 6,
    alignItems: "flex-end",
  },
  occasionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  occasionBadgeText: { color: "#0F0A05", fontSize: 11 },
  occasionName: { fontSize: 18, textAlign: "right" },
  occasionDesc: { fontSize: 13, textAlign: "right" },
  occasionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    alignSelf: "flex-end",
    marginTop: 4,
  },
  occasionBtnText: { color: "#fff", fontSize: 13 },
});
