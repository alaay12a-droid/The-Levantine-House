import React, { useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Linking,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useUser } from "@/context/UserContext";
import { useFavorites } from "@/hooks/useFavorites";
import { useMenu } from "@/hooks/useMenu";
import { MenuItemCard } from "@/components/MenuItemCard";
import { CartBar } from "@/components/CartBar";
import { FOOD_IMAGES } from "@/constants/menu";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

const RESTAURANT_LOCATION_URL =
  "https://maps.google.com/?q=تبوك+حي+الروضة+روابي+المندي";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const router = useRouter();
  const { user } = useUser();
  const { favorites } = useFavorites();
  const { categories } = useMenu();

  const [search, setSearch] = useState("");
  const searchRef = useRef<TextInput>(null);

  const allItems = useMemo(
    () => categories.flatMap((c) => c.items),
    [categories]
  );

  const searchResults = useMemo(() => {
    const q = search.trim();
    if (!q) return [];
    const lower = q.toLowerCase();
    return allItems.filter(
      (item) =>
        item.name.includes(q) ||
        (item.nameEn ?? "").toLowerCase().includes(lower) ||
        (item.description ?? "").includes(q)
    );
  }, [search, allItems]);

  const favoriteItems = useMemo(
    () => allItems.filter((item) => favorites.includes(item.id)),
    [allItems, favorites]
  );

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "صباح الخير";
    if (h >= 12 && h < 17) return "مساء الخير";
    return "أهلاً بك";
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.card }]}
            onPress={() => router.push("/onboarding")}
          >
            <Feather name="map-pin" size={18} color={colors.gold} />
          </TouchableOpacity>

          <View style={styles.greetBlock}>
            <Text style={[styles.greetName, { color: colors.foreground, fontFamily: F.extra }]}>
              {user?.name ? user.name : "روابي المندي"}
            </Text>
            <Text style={[styles.greetSub, { color: colors.mutedForeground, fontFamily: F.regular }]}>
              {greeting}
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => searchRef.current?.focus()}
          style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="search" size={18} color={colors.mutedForeground} style={{ marginLeft: 10 }} />
          <TextInput
            ref={searchRef}
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث عن صنف..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground, fontFamily: F.regular }]}
            textAlign="right"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} style={{ paddingHorizontal: 10 }}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 90,
          paddingHorizontal: 16,
          paddingTop: 16,
          gap: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Search Results */}
        {search.trim().length > 0 && (
          <View style={{ gap: 8 }}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionCount, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                {searchResults.length} نتيجة
              </Text>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: F.bold }]}>
                نتائج البحث
              </Text>
            </View>
            {searchResults.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ fontSize: 36 }}>🔍</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                  لا توجد نتائج لـ "{search}"
                </Text>
              </View>
            ) : (
              searchResults.map((item) => (
                <MenuItemCard key={item.id} item={item} />
              ))
            )}
          </View>
        )}

        {/* Favorites Section */}
        {search.trim().length === 0 && (
          <View style={{ gap: 10 }}>
            <View style={styles.sectionHeader}>
              <Feather name="heart" size={14} color="#C8171A" />
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: F.bold }]}>
                المفضلة
              </Text>
            </View>

            {favoriteItems.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ fontSize: 36 }}>🤍</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                  لم تُضف أي صنف للمفضلة بعد
                </Text>
                <Text style={[styles.emptyHint, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                  اضغط على ♡ في أي صنف لحفظه هنا
                </Text>
              </View>
            ) : (
              favoriteItems.map((item) => (
                <MenuItemCard key={item.id} item={item} />
              ))
            )}
          </View>
        )}

        {/* Location Section */}
        {search.trim().length === 0 && (
          <View style={{ gap: 10 }}>
            <View style={styles.sectionHeader}>
              <Feather name="map-pin" size={14} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: F.bold }]}>
                الموقع
              </Text>
            </View>

            {/* My Saved Address */}
            {user?.address && (
              <TouchableOpacity
                onPress={() => router.push("/onboarding")}
                style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.8}
              >
                <Feather name="chevron-left" size={18} color={colors.mutedForeground} />
                <View style={styles.locationTextBlock}>
                  <Text style={[styles.locationLabel, { color: colors.gold, fontFamily: F.bold }]}>
                    عنواني
                  </Text>
                  <Text style={[styles.locationValue, { color: colors.foreground, fontFamily: F.regular }]} numberOfLines={2}>
                    {user.address}
                  </Text>
                </View>
                <View style={[styles.locationDot, { backgroundColor: colors.gold }]}>
                  <Feather name="map-pin" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
            )}

            {/* Restaurant Location */}
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Linking.openURL(RESTAURANT_LOCATION_URL);
              }}
              style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.8}
            >
              <Feather name="chevron-left" size={18} color={colors.mutedForeground} />
              <View style={styles.locationTextBlock}>
                <Text style={[styles.locationLabel, { color: "#C8171A", fontFamily: F.bold }]}>
                  موقع المطعم
                </Text>
                <Text style={[styles.locationValue, { color: colors.foreground, fontFamily: F.regular }]}>
                  تبوك — حي الروضة
                </Text>
              </View>
              <View style={[styles.locationDot, { backgroundColor: "#C8171A" }]}>
                <Feather name="map-pin" size={14} color="#fff" />
              </View>
            </TouchableOpacity>

            {/* Change My Address */}
            <TouchableOpacity
              onPress={() => router.push("/onboarding")}
              style={[styles.changeAddressBtn, { borderColor: colors.gold }]}
              activeOpacity={0.8}
            >
              <Feather name="edit-2" size={14} color={colors.gold} />
              <Text style={[styles.changeAddressText, { color: colors.gold, fontFamily: F.bold }]}>
                {user?.address ? "تغيير عنواني" : "أضف عنوانك"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <CartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  greetBlock: {
    alignItems: "flex-end",
    gap: 1,
  },
  greetName: {
    fontSize: 18,
  },
  greetSub: {
    fontSize: 13,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    paddingHorizontal: 8,
    textAlignVertical: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
  },
  sectionCount: {
    fontSize: 12,
    marginLeft: "auto",
  },
  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  emptyHint: {
    fontSize: 12,
    textAlign: "center",
    opacity: 0.7,
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  locationTextBlock: {
    flex: 1,
    alignItems: "flex-end",
    gap: 3,
  },
  locationLabel: {
    fontSize: 13,
  },
  locationValue: {
    fontSize: 14,
    textAlign: "right",
    lineHeight: 22,
  },
  locationDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  changeAddressBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 12,
    gap: 8,
  },
  changeAddressText: {
    fontSize: 14,
  },
});
