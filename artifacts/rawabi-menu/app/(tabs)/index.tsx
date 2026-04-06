import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { MENU_CATEGORIES, RESTAURANT_INFO } from "@/constants/menu";
import { MenuItemCard } from "@/components/MenuItemCard";
import { CategoryPill } from "@/components/CategoryPill";
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
      {/* Header */}
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
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={[styles.restaurantName, { color: colors.primary }]}>
              {RESTAURANT_INFO.name}
            </Text>
            <Text style={[styles.restaurantSub, { color: colors.mutedForeground }]}>
              {RESTAURANT_INFO.location}
            </Text>
          </View>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </View>

        {/* Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContainer}
          style={styles.pillsScroll}
        >
          {MENU_CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat.id}
              label={cat.name}
              icon={cat.icon}
              active={activeCategory === cat.id}
              onPress={() => setActiveCategory(cat.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Menu Items */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Platform.OS === "web" ? 120 : 100 },
        ]}
      >
        {/* Active category header */}
        <View style={styles.categoryHeader}>
          <Text style={[styles.categoryTitle, { color: colors.foreground }]}>
            {MENU_CATEGORIES.find((c) => c.id === activeCategory)?.name}
          </Text>
          <Text style={styles.categoryIcon}>
            {MENU_CATEGORIES.find((c) => c.id === activeCategory)?.icon}
          </Text>
        </View>

        {activeItems.map((item) => (
          <MenuItemCard key={item.id} item={item} />
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
  header: {
    borderBottomWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  headerText: {
    flex: 1,
    alignItems: "flex-end",
  },
  restaurantName: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "right",
  },
  restaurantSub: {
    fontSize: 13,
    textAlign: "right",
    marginTop: 2,
  },
  pillsScroll: {
    paddingBottom: 12,
  },
  pillsContainer: {
    paddingHorizontal: 16,
    paddingRight: 8,
    flexDirection: "row",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 14,
  },
  categoryIcon: {
    fontSize: 24,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "right",
  },
});
