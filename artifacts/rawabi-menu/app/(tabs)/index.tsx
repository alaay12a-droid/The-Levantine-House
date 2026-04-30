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
import { useUser } from "@/context/UserContext";

const logo = require("@/assets/images/rawabi_logo.jpg");
const deliveryCar = require("@/assets/images/delivery_car.jpg");
const dhabihaImg = require("@/assets/images/dhabiha.png");
const dhabihaPoster = require("@/assets/images/dhabiha_poster.jpg");

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

type OrderMode = "delivery" | "pickup";

export default function MenuScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [activeCategory, setActiveCategory] = useState(MENU_CATEGORIES[0].id);
  const [orderMode, setOrderMode] = useState<OrderMode>("delivery");

  const activeCat = MENU_CATEGORIES.find((c) => c.id === activeCategory);
  const topInset = Platform.OS === "web" ? 0 : insets.top;

  const handleWhatsApp = (msg: string) => {
    Linking.openURL(`https://wa.me/${RESTAURANT_INFO.whatsapp}?text=${encodeURIComponent(msg)}`);
  };

  const handleCall = () => {
    Linking.openURL(`tel:${RESTAURANT_INFO.phone}`);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#C8171A" />

      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: topInset }]}>
        {/* Top row: location */}
        <View style={styles.locationRow}>
          <TouchableOpacity onPress={handleCall}>
            <Feather name="phone" size={18} color="#fff" />
          </TouchableOpacity>
          <View style={styles.locationTextWrap}>
            <Image source={logo} style={styles.headerLogo} resizeMode="contain" />
            {user?.address ? (
              <View style={styles.locationAddrRow}>
                <Feather name="chevron-down" size={13} color="#FFD0D0" />
                <Text style={[styles.locationSub, { fontFamily: F.regular }]} numberOfLines={1}>
                  {user.address}
                </Text>
              </View>
            ) : (
              <Text style={[styles.locationSub, { fontFamily: F.regular }]}>
                حدد موقعك للتوصيل
              </Text>
            )}
          </View>
          <Feather name="map-pin" size={18} color="#fff" />
        </View>

        {/* Delivery / Pickup toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              orderMode === "delivery"
                ? styles.toggleActive
                : styles.toggleInactive,
            ]}
            onPress={() => setOrderMode("delivery")}
            activeOpacity={0.85}
          >
            {orderMode === "delivery" && (
              <View style={styles.toggleCheck}>
                <Feather name="check" size={12} color="#C8171A" />
              </View>
            )}
            <Feather
              name="truck"
              size={16}
              color={orderMode === "delivery" ? "#C8171A" : "#fff"}
            />
            <Text
              style={[
                styles.toggleLabel,
                { fontFamily: F.bold, color: orderMode === "delivery" ? "#C8171A" : "#fff" },
              ]}
            >
              خدمة توصيل
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleBtn,
              orderMode === "pickup"
                ? styles.toggleActive
                : styles.toggleInactive,
            ]}
            onPress={() => setOrderMode("pickup")}
            activeOpacity={0.85}
          >
            {orderMode === "pickup" && (
              <View style={styles.toggleCheck}>
                <Feather name="check" size={12} color="#C8171A" />
              </View>
            )}
            <Feather
              name="shopping-bag"
              size={16}
              color={orderMode === "pickup" ? "#C8171A" : "#fff"}
            />
            <Text
              style={[
                styles.toggleLabel,
                { fontFamily: F.bold, color: orderMode === "pickup" ? "#C8171A" : "#fff" },
              ]}
            >
              استلام
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── CATEGORY TABS ── */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.background }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
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
                    : { backgroundColor: "transparent", borderColor: "#3A2410" },
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: active ? "#fff" : colors.mutedForeground, fontFamily: F.bold },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── CONTENT ── */}
      {activeCat?.isDelivery ? (
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
              للحجز والاستفسار عن الأسعار تواصل معنا على الرقم المخصص
            </Text>
            <View style={[styles.dhabihaPhoneRow, { borderColor: colors.gold }]}>
              <Feather name="phone" size={16} color={colors.gold} />
              <Text style={[styles.dhabihaPhoneNum, { color: colors.gold, fontFamily: F.extra }]}>
                {RESTAURANT_INFO.dhabihaPhone}
              </Text>
            </View>
            <View style={styles.bookBtns}>
              <TouchableOpacity
                onPress={() => Linking.openURL(`https://wa.me/${RESTAURANT_INFO.dhabihaWhatsapp}?text=${encodeURIComponent("السلام عليكم، أرغب في حجز ذبيحة والاستفسار عن الأسعار")}`)}
                style={[styles.bookBtn, { backgroundColor: "#1DBF47" }]}
              >
                <Feather name="message-circle" size={16} color="#fff" />
                <Text style={[styles.bookBtnText, { fontFamily: F.bold }]}>واتساب</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${RESTAURANT_INFO.dhabihaPhone}`)}
                style={[styles.bookBtn, { backgroundColor: colors.primary }]}
              >
                <Feather name="phone" size={16} color="#fff" />
                <Text style={[styles.bookBtnText, { fontFamily: F.bold }]}>اتصل الآن</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : activeCat?.isOccasions ? (
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Platform.OS === "web" ? 130 : 110 },
          ]}
        >
          {/* Promo Banner */}
          <View style={styles.bannerWrap}>
            <Image source={deliveryCar} style={styles.bannerImg} resizeMode="cover" />
            <View style={[styles.bannerOverlay]}>
              <Text style={[styles.bannerText, { fontFamily: F.extra }]}>
                طلب التوصيل عبر واتساب
              </Text>
              <TouchableOpacity
                onPress={() => handleWhatsApp("السلام عليكم، أرغب في طلب توصيل")}
                style={styles.bannerBtn}
              >
                <Text style={[styles.bannerBtnText, { fontFamily: F.bold }]}>اطلب الآن</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section title */}
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionName, { color: colors.foreground, fontFamily: F.extra }]}>
              {activeCat?.name}
            </Text>
          </View>

          {activeCat?.items.map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))}
        </ScrollView>
      )}

      <CartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* Header */
  header: {
    backgroundColor: "#C8171A",
    paddingBottom: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
  },
  locationTextWrap: {
    flex: 1,
    alignItems: "center",
  },
  headerLogo: {
    width: 140,
    height: 40,
  },
  locationSub: {
    color: "#FFD0D0",
    fontSize: 12,
    textAlign: "center",
    marginTop: 2,
  },
  locationAddrRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    marginTop: 2,
  },

  /* Toggle */
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    position: "relative",
  },
  toggleActive: {
    backgroundColor: "#fff",
  },
  toggleInactive: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  toggleLabel: {
    fontSize: 14,
  },
  toggleCheck: {
    position: "absolute",
    top: 6,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFE0E0",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Category tabs */
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#2A1A0A",
  },
  tabsContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabLabel: { fontSize: 13 },

  /* Section title */
  sectionRow: {
    alignItems: "flex-end",
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  sectionName: { fontSize: 18 },

  list: { padding: 14 },

  /* Banner */
  bannerWrap: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 14,
    height: 130,
  },
  bannerImg: {
    width: "100%",
    height: "100%",
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,10,5,0.6)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  bannerText: {
    color: "#fff",
    fontSize: 16,
    flex: 1,
    textAlign: "right",
  },
  bannerBtn: {
    backgroundColor: "#C8171A",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 10,
  },
  bannerBtnText: {
    color: "#fff",
    fontSize: 13,
  },

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
  dhabihaPhoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "flex-end",
    marginVertical: 4,
  },
  dhabihaPhoneNum: { fontSize: 18, letterSpacing: 1 },
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
