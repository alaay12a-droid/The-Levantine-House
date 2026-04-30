import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function OffersScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>لا توجد عروض حالياً</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0A05", alignItems: "center", justifyContent: "center" },
  text: { color: "#9A7A5A", fontSize: 16, fontFamily: "Cairo_600SemiBold" },
});
