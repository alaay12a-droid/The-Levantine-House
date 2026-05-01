import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTabConfig } from "@/hooks/useTabConfig";
import { useOrderBadge } from "@/context/OrderBadgeContext";

const GOLD = "#E8920C";
const MUTED = "#9A7A5A";
const BG = "#1A1008";
const BORDER = "#3A2410";

export default function TabLayout() {
  const { config, loaded } = useTabConfig();
  const { activeCount } = useOrderBadge();

  if (!loaded) return null;

  const h = Platform.OS === "web" ? config.height : config.height + 10;
  const pb = Platform.OS === "web" ? config.paddingBottom : config.paddingBottom + 8;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: BG,
          borderTopColor: BORDER,
          borderTopWidth: 1,
          height: h,
          paddingBottom: pb,
          paddingTop: 8,
        },
        tabBarActiveTintColor: GOLD,
        tabBarInactiveTintColor: MUTED,
        tabBarLabelStyle: {
          fontFamily: "Cairo_700Bold",
          fontSize: config.fontSize,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "القائمة",
          tabBarIcon: ({ color, size }) => (
            <Feather name="grid" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="offers"
        options={{
          title: "العروض",
          tabBarIcon: ({ color, size }) => (
            <Feather name="tag" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "الطلبات",
          tabBarIcon: ({ color, size }) => (
            <Feather name="shopping-bag" size={size - 2} color={color} />
          ),
          tabBarBadge: activeCount > 0 ? activeCount : undefined,
          tabBarBadgeStyle: { backgroundColor: "#E8920C", color: "#fff", fontSize: 10, fontFamily: "Cairo_700Bold" },
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "المزيد",
          tabBarIcon: ({ color, size }) => (
            <Feather name="menu" size={size - 2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
