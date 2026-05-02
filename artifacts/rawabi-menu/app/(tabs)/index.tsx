import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  SectionList,
  StyleSheet,
  Platform,
  Image,
  TouchableOpacity,
  StatusBar,
  Linking,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { FOOD_IMAGES, RESTAURANT_INFO } from "@/constants/menu";
import { MenuItemCard } from "@/components/MenuItemCard";
import { CartBar } from "@/components/CartBar";
import { useMenu } from "@/hooks/useMenu";
import { useOccasions } from "@/hooks/useOccasions";
import { useBanners } from "@/hooks/useBanners";
import { BannerCarousel } from "@/components/BannerCarousel";
import { useCombos, type ApiCombo } from "@/hooks/useCombos";
import { useCart } from "@/context/CartContext";

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

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList<any, any>);
const HEADER_TOP_H = 82;

export default function MenuScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { categories } = useMenu();
  const { occasions } = useOccasions();
  const { banners, refresh: refreshBanners } = useBanners();
  const { combos } = useCombos();
  const { addItem } = useCart();
  const availableCombos = combos.filter((c) => c.available);
  const [activeCategory, setActiveCategory] = useState("chicken");

  useEffect(() => { refreshBanners(); }, [refreshBanners]);
  const sectionListRef = useRef<any>(null);
  const tabsScrollRef = useRef<ScrollView>(null);
  const isScrollingProgrammatically = useRef(false);

  // ── Collapsing header animation ──
  const lastY = useSharedValue(0);
  const headerVisible = useSharedValue(1); // 1=expanded 0=collapsed

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const diff = y - lastY.value;
      lastY.value = y;
      if (y <= 10) {
        headerVisible.value = withTiming(1, { duration: 200 });
      } else if (diff > 4) {
        headerVisible.value = withTiming(0, { duration: 220 });
      } else if (diff < -4) {
        headerVisible.value = withTiming(1, { duration: 220 });
      }
    },
  });

  const headerTopStyle = useAnimatedStyle(() => ({
    height: interpolate(headerVisible.value, [0, 1], [0, HEADER_TOP_H], Extrapolation.CLAMP),
    opacity: interpolate(headerVisible.value, [0, 0.6], [0, 1], Extrapolation.CLAMP),
    overflow: "hidden",
  }));

  const regularCats = categories.filter((c) => !c.isDelivery && !c.isDhabiha && !c.isOccasions);
  const specialCat = categories.find((c) => c.id === activeCategory && (c.isDelivery || c.isDhabiha || c.isOccasions));
  const activeCat = categories.find((c) => c.id === activeCategory) ?? categories[0];
  const topInset = Platform.OS === "web" ? 60 : insets.top;

  const sections = regularCats.map((cat) => ({
    id: cat.id,
    icon: cat.icon,
    name: cat.name,
    count: cat.items.length,
    data: cat.items,
  }));

  const handleTabPress = useCallback((catId: string) => {
    setActiveCategory(catId);
    const cat = categories.find((c) => c.id === catId);
    if (cat?.isDelivery || cat?.isDhabiha || cat?.isOccasions) return;
    const sectionIndex = regularCats.findIndex((c) => c.id === catId);
    if (sectionIndex === -1 || !sectionListRef.current) return;
    isScrollingProgrammatically.current = true;
    try {
      sectionListRef.current.scrollToLocation({ sectionIndex, itemIndex: 0, viewPosition: 0, animated: true });
    } catch {}
    setTimeout(() => { isScrollingProgrammatically.current = false; }, 800);
  }, [categories, regularCats]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (isScrollingProgrammatically.current) return;
    for (const vi of viewableItems) {
      if (vi.section) {
        setActiveCategory(vi.section.id);
        break;
      }
    }
  }, []);

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
        <Animated.View style={[styles.headerRow, headerTopStyle]}>
          <View style={{ gap: 8 }}>
            <TouchableOpacity
              onPress={handleCall}
              style={[styles.phoneBtn, { backgroundColor: "#2A1508" }]}
            >
              <Feather name="phone" size={18} color={colors.gold} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/cashier")}
              style={[styles.phoneBtn, { backgroundColor: "#2A1508" }]}
            >
              <Feather name="monitor" size={16} color={colors.gold} />
            </TouchableOpacity>
          </View>

          <View style={styles.titleBlock}>
            <Text style={[styles.brandName, { fontFamily: F.extra }]}>روابي المندي</Text>
            <Text style={[styles.tagline, { color: colors.gold, fontFamily: F.semi }]}>
              للمذاق فن وأصول
            </Text>
          </View>

          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </Animated.View>

        {/* ── CATEGORY TABS ── */}
        <ScrollView
          ref={tabsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
          style={styles.tabsScroll}
        >
          {categories.filter((c) => !c.isOccasions).map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => handleTabPress(cat.id)}
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
      {specialCat?.isDelivery ? (
        /* ── DELIVERY SECTION ── */
        <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} onScroll={scrollHandler} scrollEventThrottle={16}>
          <BannerCarousel banners={banners} />
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
        </Animated.ScrollView>
      ) : specialCat?.isDhabiha ? (
        /* ── DHABIHA SECTION ── */
        <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} onScroll={scrollHandler} scrollEventThrottle={16}>
          <BannerCarousel banners={banners} />
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
        </Animated.ScrollView>
      ) : specialCat?.isOccasions ? (
        /* ── OCCASIONS SECTION ── */
        <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} onScroll={scrollHandler} scrollEventThrottle={16}>
          <BannerCarousel banners={banners} />
          <View style={[styles.occasionsHeader, { backgroundColor: "#1A0D00", borderColor: colors.gold }]}>
            <Text style={[styles.occasionsTitle, { color: colors.gold, fontFamily: F.extra }]}>🎉 عروض المناسبات</Text>
            <Text style={[styles.occasionsSub, { color: colors.mutedForeground, fontFamily: F.semi }]}>
              عروض خاصة لكل مناسبة — تواصل معنا لمعرفة التفاصيل
            </Text>
          </View>

          {occasions.map((occ) => (
            <TouchableOpacity
              key={occ.occasionId}
              activeOpacity={0.85}
              onPress={() => handleWhatsApp(`السلام عليكم، أرغب في الاستفسار عن: ${occ.name}`)}
              style={[styles.occasionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {occ.imageUrl ? (
                <Image source={{ uri: occ.imageUrl }} style={styles.occasionImg} resizeMode="cover" />
              ) : occ.imageKey && FOOD_IMAGES[occ.imageKey] ? (
                <Image source={FOOD_IMAGES[occ.imageKey]} style={styles.occasionImg} resizeMode="cover" />
              ) : null}
              <View style={[styles.occasionOverlay, { backgroundColor: "#0F0A05CC" }]}>
                <View style={[styles.occasionBadge, { backgroundColor: colors.gold }]}>
                  <Text style={[styles.occasionBadgeText, { fontFamily: F.bold }]}>عرض خاص</Text>
                </View>
                <Text style={[styles.occasionName, { color: "#FFFFFF", fontFamily: F.extra }]}>{occ.name}</Text>
                {occ.description ? (
                  <Text style={[styles.occasionDesc, { color: "#FFFFFF99", fontFamily: F.semi }]}>{occ.description}</Text>
                ) : null}
                <View style={[styles.occasionBtn, { backgroundColor: "#1DBF47" }]}>
                  <Feather name="message-circle" size={15} color="#fff" />
                  <Text style={[styles.occasionBtnText, { fontFamily: F.bold }]}>استفسر عبر واتساب</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.ScrollView>
      ) : (
        /* ── REGULAR MENU — continuous SectionList ── */
        <AnimatedSectionList
          ref={sectionListRef}
          sections={sections}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={true}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 10 }}
          contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 130 : 110 }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          ListHeaderComponent={() => (
            <View>
              {/* ── BANNER inside scroll ── */}
              <BannerCarousel banners={banners} />

              {/* ── COMBOS ── */}
              {availableCombos.length > 0 && (
              <View style={{ paddingBottom: 8 }}>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
                <Text style={{ color: "#82B1FF", fontFamily: F.extra, fontSize: 16 }}>🎁 الوجبات المجمعة</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 10, flexDirection: "row-reverse" }}>
                {availableCombos.map((combo) => (
                  <View key={combo.comboId} style={{ width: 200, backgroundColor: "#0F1A2A", borderRadius: 16, padding: 12, gap: 8, borderWidth: 1, borderColor: "#82B1FF33" }}>
                    {combo.imageUrl ? (
                      <Image source={{ uri: combo.imageUrl }} style={{ width: "100%", height: 100, borderRadius: 10 }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: "100%", height: 80, borderRadius: 10, backgroundColor: "#1A2A3A", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 36 }}>🎁</Text>
                      </View>
                    )}
                    <Text style={{ color: "#fff", fontFamily: F.bold, fontSize: 14, textAlign: "right" }} numberOfLines={2}>{combo.name}</Text>
                    <View style={{ gap: 3 }}>
                      {combo.components.map((comp, i) => (
                        <Text key={i} style={{ color: "#82B1FF99", fontFamily: F.regular, fontSize: 11, textAlign: "right" }}>
                          {"×" + comp.quantity + " " + comp.name}
                        </Text>
                      ))}
                    </View>
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                      <Text style={{ color: "#FFD700", fontFamily: F.bold, fontSize: 15 }}>{combo.price.toFixed(2)} ر.س</Text>
                      <TouchableOpacity
                        onPress={() => addItem({ id: `combo-${combo.comboId}`, name: combo.name, price: combo.price, category: "combo", description: combo.components.map(c => `×${c.quantity} ${c.name}`).join(" | "), imageUrl: combo.imageUrl ?? undefined })}
                        style={{ backgroundColor: "#82B1FF22", borderWidth: 1, borderColor: "#82B1FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row-reverse", alignItems: "center", gap: 4 }}
                      >
                        <Feather name="plus" size={14} color="#82B1FF" />
                        <Text style={{ color: "#82B1FF", fontFamily: F.bold, fontSize: 12 }}>أضف</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
              )}
            </View>
          )}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionRow, { backgroundColor: colors.background, borderBottomColor: "#2A1A0A", borderTopColor: "#2A1A0A" }]}>
              <Text style={[styles.itemCount, { color: colors.mutedForeground, fontFamily: F.semi }]}>
                {section.count} أصناف
              </Text>
              <View style={styles.sectionTitle}>
                <Text style={[styles.sectionName, { color: colors.foreground, fontFamily: F.extra }]}>
                  {section.name}
                </Text>
                <Text style={styles.sectionIcon}>{section.icon}</Text>
              </View>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
              <MenuItemCard item={item} />
            </View>
          )}
          SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
        />

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
    borderTopWidth: 1,
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
