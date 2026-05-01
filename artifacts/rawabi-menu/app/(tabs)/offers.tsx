import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

export default function OffersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const [activeTab, setActiveTab] = useState<"offers" | "codes">("offers");

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
          العروض
        </Text>
      </View>

      <View style={[styles.subTabRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.subTab,
            activeTab === "offers" && { borderBottomColor: colors.gold, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab("offers")}
        >
          <Text
            style={[
              styles.subTabText,
              {
                fontFamily: F.bold,
                color: activeTab === "offers" ? colors.gold : colors.mutedForeground,
              },
            ]}
          >
            العروض
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subTab,
            activeTab === "codes" && { borderBottomColor: colors.gold, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab("codes")}
        >
          <Text
            style={[
              styles.subTabText,
              {
                fontFamily: F.bold,
                color: activeTab === "codes" ? colors.gold : colors.mutedForeground,
              },
            ]}
          >
            أكواد الخصم
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.emptyWrap}>
        <Feather
          name={activeTab === "offers" ? "tag" : "percent"}
          size={52}
          color={colors.border}
        />
        <Text
          style={[
            styles.emptyText,
            { color: colors.mutedForeground, fontFamily: F.semi },
          ]}
        >
          {activeTab === "offers"
            ? "لا توجد عروض حالياً،\nالرجاء زيارة هذه الصفحة لاحقاً\nلاستعراض أحدث العروض"
            : "لا توجد أكواد خصم متاحة حالياً"}
        </Text>
      </View>
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
  title: {
    fontSize: 20,
  },
  subTabRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
  },
  subTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  subTabText: {
    fontSize: 14,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 26,
  },
});
