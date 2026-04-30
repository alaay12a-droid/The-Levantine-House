import { Tabs } from "expo-router";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

function TabIcon({ name, label, focused }: { name: any; label: string; focused: boolean }) {
  return (
    <View style={tabStyles.iconWrap}>
      <Feather name={name} size={22} color={focused ? "#C8171A" : "#9A7A5A"} />
      <Text style={[tabStyles.label, { color: focused ? "#C8171A" : "#9A7A5A" }]}>{label}</Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrap: { alignItems: "center", gap: 3, paddingTop: 4 },
  label: { fontSize: 11, fontFamily: "Cairo_600SemiBold" },
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#eee",
          height: 60,
          paddingBottom: 4,
        },
        tabBarActiveTintColor: "#C8171A",
        tabBarInactiveTintColor: "#9A7A5A",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) => <TabIcon name="grid" label="القائمة" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="offers"
        options={{
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) => <TabIcon name="tag" label="العروض" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) => <TabIcon name="shopping-bag" label="الطلبات" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) => <TabIcon name="menu" label="المزيد" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
