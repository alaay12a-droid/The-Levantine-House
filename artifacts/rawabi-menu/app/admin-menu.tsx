import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  Switch,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useMenu, type ApiMenuItem } from "@/hooks/useMenu";
import { apiPost, apiPut, apiDelete } from "@/constants/api";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

const ADMIN_PIN = "Aa@000";

const CATEGORIES = [
  { id: "chicken",  name: "الدجاج",   icon: "🍗" },
  { id: "meat",     name: "اللحوم",   icon: "🥩" },
  { id: "sides",    name: "الإيدامات", icon: "🥘" },
  { id: "salads",   name: "السلطات",  icon: "🥗" },
  { id: "desserts", name: "الحلويات", icon: "🍮" },
  { id: "drinks",   name: "المشروبات", icon: "🥤" },
  { id: "extras",   name: "إضافات",   icon: "✨" },
];

function getCatMeta(catId: string) {
  return CATEGORIES.find((c) => c.id === catId) ?? { id: catId, name: catId, icon: "🍽️" };
}

function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const topInset = Platform.OS === "web" ? 80 : insets.top;

  const handleConfirm = () => {
    if (pin === ADMIN_PIN) {
      onSuccess();
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <View style={[styles.pinContainer, { backgroundColor: colors.background, paddingTop: topInset }]}>
      <StatusBar barStyle="light-content" />
      <TouchableOpacity onPress={() => router.back()} style={styles.pinBack}>
        <Feather name="arrow-right" size={22} color={colors.mutedForeground} />
      </TouchableOpacity>
      <Text style={[styles.pinTitle, { color: colors.foreground, fontFamily: F.extra }]}>
        🔐 إدارة القائمة
      </Text>
      <Text style={[styles.pinSubtitle, { color: colors.mutedForeground, fontFamily: F.regular }]}>
        أدخل رمز الدخول
      </Text>
      <TextInput
        style={[styles.pinInput, { backgroundColor: colors.card, borderColor: error ? "#E53935" : colors.border, color: colors.foreground, fontFamily: F.bold }]}
        value={pin}
        onChangeText={(t) => { setPin(t); setError(false); }}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="••••••"
        placeholderTextColor={colors.mutedForeground}
        onSubmitEditing={handleConfirm}
        returnKeyType="done"
      />
      {error && (
        <Text style={[styles.pinError, { fontFamily: F.semi }]}>رمز خاطئ، حاول مجدداً</Text>
      )}
      <TouchableOpacity
        onPress={handleConfirm}
        style={[styles.pinConfirmBtn, { backgroundColor: colors.gold }]}
        activeOpacity={0.8}
      >
        <Text style={[styles.pinConfirmText, { color: "#1A0A00", fontFamily: F.extra }]}>دخول</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AdminMenuScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { apiItems: items, refresh } = useMenu();

  const topInset = Platform.OS === "web" ? 60 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [authenticated, setAuthenticated] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState<ApiMenuItem | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState("chicken");

  if (!authenticated) {
    return <PinScreen onSuccess={() => setAuthenticated(true)} />;
  }

  const filtered = filterCat === "all"
    ? items
    : items.filter((i) => i.category === filterCat);

  const handleToggleAvail = async (item: ApiMenuItem) => {
    setLoading(item.itemId);
    try {
      await apiPut(`/menu/${item.itemId}`, { available: !item.available });
      await refresh();
    } catch {
      Alert.alert("خطأ", "تعذر تحديث الحالة");
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = (item: ApiMenuItem) => {
    Alert.alert(
      "حذف الصنف",
      `هل تريد حذف "${item.name}"؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            setLoading(item.itemId);
            try {
              await apiDelete(`/menu/${item.itemId}`);
              await refresh();
            } catch {
              Alert.alert("خطأ", "تعذر الحذف");
            } finally {
              setLoading(null);
            }
          },
        },
      ]
    );
  };

  const openEdit = (item: ApiMenuItem) => {
    setEditItem(item);
    setNewName(item.name);
    setNewPrice((item.price / 100).toString());
    setNewCategory(item.category);
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    const priceNum = parseFloat(newPrice);
    if (!newName.trim() || isNaN(priceNum) || priceNum <= 0) {
      Alert.alert("خطأ", "تأكد من صحة الاسم والسعر");
      return;
    }
    setLoading(editItem.itemId);
    try {
      await apiPut(`/menu/${editItem.itemId}`, {
        name: newName.trim(),
        price: priceNum,
        category: newCategory,
      });
      await refresh();
      setEditItem(null);
    } catch {
      Alert.alert("خطأ", "تعذر الحفظ");
    } finally {
      setLoading(null);
    }
  };

  const handleAdd = async () => {
    const priceNum = parseFloat(newPrice);
    if (!newName.trim() || isNaN(priceNum) || priceNum <= 0) {
      Alert.alert("خطأ", "تأكد من صحة الاسم والسعر");
      return;
    }
    setLoading("add");
    try {
      await apiPost("/menu", {
        name: newName.trim(),
        price: priceNum,
        category: newCategory,
      });
      await refresh();
      setShowAddModal(false);
      setNewName("");
      setNewPrice("");
      setNewCategory("chicken");
    } catch {
      Alert.alert("خطأ", "تعذر الإضافة");
    } finally {
      setLoading(null);
    }
  };

  const openAdd = () => {
    setNewName("");
    setNewPrice("");
    setNewCategory("chicken");
    setShowAddModal(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: "#1A1008", paddingTop: topInset + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.secondary }]}>
          <Feather name="arrow-right" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: F.bold }]}>
          إدارة القائمة
        </Text>
        <TouchableOpacity onPress={openAdd} style={[styles.iconBtn, { backgroundColor: colors.gold }]}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={{ backgroundColor: "#1A1008" }}
      >
        <TouchableOpacity
          onPress={() => setFilterCat("all")}
          style={[styles.filterTab, { backgroundColor: filterCat === "all" ? colors.gold : colors.secondary, borderColor: filterCat === "all" ? colors.gold : colors.border }]}
        >
          <Text style={[styles.filterText, { color: filterCat === "all" ? "#1A1008" : colors.mutedForeground, fontFamily: F.bold }]}>الكل ({items.length})</Text>
        </TouchableOpacity>
        {CATEGORIES.map((cat) => {
          const count = items.filter((i) => i.category === cat.id).length;
          const active = filterCat === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setFilterCat(cat.id)}
              style={[styles.filterTab, { backgroundColor: active ? colors.gold : colors.secondary, borderColor: active ? colors.gold : colors.border }]}
            >
              <Text style={[styles.filterText, { color: active ? "#1A1008" : colors.mutedForeground, fontFamily: F.bold }]}>
                {cat.icon} {cat.name} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Items list */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 20 }]}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>🍽️</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: F.semi }]}>لا توجد أصناف</Text>
          </View>
        ) : (
          filtered.map((item) => {
            const cat = getCatMeta(item.category);
            const priceStr = (item.price / 100) % 1 === 0
              ? (item.price / 100).toString()
              : (item.price / 100).toFixed(2);
            const isLoading = loading === item.itemId;

            return (
              <View key={item.itemId} style={[styles.card, { backgroundColor: colors.card, borderColor: item.available ? colors.border : "#5A2A2A" }]}>
                <View style={styles.cardTop}>
                  <View style={styles.cardLeft}>
                    {isLoading ? (
                      <ActivityIndicator size="small" color={colors.gold} />
                    ) : (
                      <Switch
                        value={item.available}
                        onValueChange={() => handleToggleAvail(item)}
                        trackColor={{ false: "#3A1A1A", true: "#2A5A2A" }}
                        thumbColor={item.available ? "#4CAF50" : "#E57373"}
                      />
                    )}
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.itemName, { color: item.available ? colors.foreground : colors.mutedForeground, fontFamily: F.bold }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <View style={styles.itemMeta}>
                      <Text style={[styles.itemCat, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                        {cat.icon} {cat.name}
                      </Text>
                      <Text style={[styles.itemPrice, { color: colors.gold, fontFamily: F.extra }]}>
                        {priceStr} ر.س
                      </Text>
                    </View>
                    {!item.available && (
                      <View style={[styles.unavailBadge, { backgroundColor: "#5A1A1A" }]}>
                        <Text style={[styles.unavailText, { fontFamily: F.bold }]}>نافد</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                  <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.actionBtn, { backgroundColor: "#3A1A1A" }]}>
                    <Feather name="trash-2" size={15} color="#E57373" />
                    <Text style={[styles.actionText, { color: "#E57373", fontFamily: F.bold }]}>حذف</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openEdit(item)} style={[styles.actionBtn, { backgroundColor: "#1A2A3A" }]}>
                    <Feather name="edit-2" size={15} color="#64B5F6" />
                    <Text style={[styles.actionText, { color: "#64B5F6", fontFamily: F.bold }]}>تعديل</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal
        visible={showAddModal || editItem !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowAddModal(false); setEditItem(null); }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: F.extra }]}>
              {editItem ? "تعديل الصنف" : "إضافة صنف جديد"}
            </Text>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>اسم الصنف</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="مثال: مندي دجاج كامل"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary, fontFamily: F.regular }]}
              textAlign="right"
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>السعر (ريال)</Text>
            <TextInput
              value={newPrice}
              onChangeText={setNewPrice}
              placeholder="مثال: 44"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary, fontFamily: F.regular }]}
              textAlign="right"
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>التصنيف</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catPicker}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setNewCategory(cat.id)}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: newCategory === cat.id ? colors.gold : colors.secondary,
                      borderColor: newCategory === cat.id ? colors.gold : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.catChipText, { color: newCategory === cat.id ? "#1A1008" : colors.foreground, fontFamily: F.bold }]}>
                    {cat.icon} {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => { setShowAddModal(false); setEditItem(null); }}
                style={[styles.modalBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground, fontFamily: F.bold }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={editItem ? handleSaveEdit : handleAdd}
                disabled={loading === "add" || loading === editItem?.itemId}
                style={[styles.modalBtn, { backgroundColor: colors.gold, flex: 1.5 }]}
              >
                {loading === "add" || loading === editItem?.itemId ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "#fff", fontFamily: F.bold }]}>
                    {editItem ? "حفظ التعديلات" : "إضافة الصنف"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, textAlign: "center" },
  filterRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  filterTab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13 },
  list: { padding: 12, gap: 10 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center", padding: 12, gap: 12 },
  cardLeft: { width: 48, alignItems: "center" },
  cardInfo: { flex: 1, gap: 4 },
  itemName: { fontSize: 15, textAlign: "right" },
  itemMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemCat: { fontSize: 12 },
  itemPrice: { fontSize: 16 },
  unavailBadge: { alignSelf: "flex-end", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  unavailText: { color: "#E57373", fontSize: 11 },
  cardActions: { flexDirection: "row", borderTopWidth: 1, gap: 0 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 6 },
  actionText: { fontSize: 13 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "#00000088" },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  modalTitle: { fontSize: 20, textAlign: "center", marginBottom: 4 },
  fieldLabel: { fontSize: 13, textAlign: "right" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  catPicker: { gap: 8, paddingVertical: 4 },
  catChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  catChipText: { fontSize: 13 },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" },
  modalBtnText: { fontSize: 15 },
  pinContainer: { flex: 1, alignItems: "center", paddingTop: 40, padding: 24 },
  pinBack: { alignSelf: "flex-start", marginBottom: 20, padding: 4 },
  pinTitle: { fontSize: 26, marginBottom: 8 },
  pinSubtitle: { fontSize: 15, marginBottom: 24 },
  pinInput: {
    width: "100%",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 20,
    textAlign: "center",
    letterSpacing: 4,
    marginBottom: 10,
  },
  pinError: { color: "#E53935", fontSize: 14, marginBottom: 10 },
  pinConfirmBtn: { width: "100%", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 6 },
  pinConfirmText: { fontSize: 18 },
});
