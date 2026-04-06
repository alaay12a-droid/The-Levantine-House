import React, { useState, useRef } from "react";
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

  const topInset = Platform.OS === "web" ? 60 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Hero Header */}
      <View style={[styles.hero, { paddingTop: topInset }]}>
        <View style={styles.heroTop}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <View style={styles.heroText}>
            <Text style={[styles.restaurantName, { color: "#FFFFFF" }]}>
              روابي المندي
            </Text>
            <View style={styles.taglineRow}>
              <View style={[styles.taglineLine, { backgroundColor: colors.gold }]} />
              <Text style={[styles.tagline, { color: colors.gold }]}>
                {RESTAURANT_INFO.tagline}
              </Text>
              <View style={[styles.taglineLine, { backgroundColor: colors.gold }]} />
            </View>
            <Text style={[styles.location, { color: colors.mutedForeground }]}>
              {RESTAURANT_INFO.location}
            </Text>
          </View>
        </View>
      </View>

      {/* Category Tabs */}
      <View style={[styles.categoryBar, { backgroundColor: colors.surface }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {MENU_CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setActiveCategory(cat.id)}
                activeOpacity={0.8}
                style={[
                  styles.catTab,
                  active && { backgroundColor: colors.primary },
                  !active && { backgroundColor: colors.card },
                ]}
              >
                <Text style={styles.catIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.catLabel,
                    { color: active ? "#FFFFFF" : colors.mutedForeground },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Section title */}
      <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
        <View style={[styles.sectionAccent, { backgroundColor: colors.gold }]} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {MENU_CATEGORIES.find((c) => c.id === activeCategory)?.name}
        </Text>
      </View>

      {/* Items */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Platform.OS === "web" ? 130 : 110 },
        ]}
      >
        {activeItems.map((item, index) => (
          <MenuItemCard key={item.id} item={item} index={index} />
        ))}
      </ScrollView>

      <CartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#1A1008",
    borderBottomWidth: 1,
    borderBottomColor: "#3A2410",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 10,
  },
  logo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#2A1A0A",
  },
  heroText: {
    flex: 1,
    alignItems: "flex-end",
  },
  restaurantName: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "right",
    letterSpacing: 0.5,
  },
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  taglineLine: {
    height: 1.5,
    flex: 1,
    opacity: 0.6,
  },
  tagline: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  location: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 5,
  },
  categoryBar: {
    borderBottomWidth: 1,
    borderBottomColor: "#3A2410",
  },
  categoryScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    flexDirection: "row",
  },
  catTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginLeft: 4,
  },
  catIcon: {
    fontSize: 15,
  },
  catLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 10,
  },
  sectionAccent: {
    width: 4,
    height: 22,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "right",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
});
