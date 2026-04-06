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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { MENU_CATEGORIES, RESTAURANT_INFO } from "@/constants/menu";
import { MenuItemCard } from "@/components/MenuItemCard";
import { CartBar } from "@/components/CartBar";

const logo = require("@/assets/images/logo.png");

export default function MenuScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState(MENU_CATEGORIES[0].id);

  const activeItems =
    MENU_CATEGORIES.find((c) => c.id === activeCategory)?.items ?? [];
  const activeCategory_ = MENU_CATEGORIES.find((c) => c.id === activeCategory);

  const topInset = Platform.OS === "web" ? 60 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* ── HEADER ── */}
      <View style={[styles.header, { paddingTop: topInset }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={[styles.phoneBtn, { backgroundColor: "#2A1508" }]}>
            <Feather name="phone" size={18} color={colors.gold} />
          </TouchableOpacity>

          <View style={styles.titleBlock}>
            <Text style={styles.brandName}>روابي المندي</Text>
            <Text style={[styles.tagline, { color: colors.gold }]}>
              {RESTAURANT_INFO.tagline}
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
                <Text style={[styles.tabLabel, { color: active ? "#fff" : colors.mutedForeground }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── SECTION HEADING ── */}
      <View style={[styles.sectionRow, { borderBottomColor: "#2A1A0A" }]}>
        <Text style={[styles.itemCount, { color: colors.mutedForeground }]}>
          {activeItems.length} أصناف
        </Text>
        <View style={styles.sectionTitle}>
          <Text style={[styles.sectionName, { color: colors.foreground }]}>
            {activeCategory_?.name}
          </Text>
          <Text style={styles.sectionIcon}>{activeCategory_?.icon}</Text>
        </View>
      </View>

      {/* ── MENU ITEMS ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 130 : 110 },
        ]}
      >
        {activeItems.map((item) => (
          <MenuItemCard key={item.id} item={item} />
        ))}
      </ScrollView>

      <CartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
  tabsScroll: {
    paddingBottom: 14,
  },
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
  tabIcon: {
    fontSize: 15,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
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
  sectionName: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionIcon: {
    fontSize: 20,
  },
  itemCount: {
    fontSize: 13,
    fontWeight: "500",
  },
  list: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
});
