import React, { useState, useCallback, useEffect } from "react";
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
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { useMenu, type ApiMenuItem } from "@/hooks/useMenu";
import type { ApiOccasion } from "@/hooks/useOccasions";
import { useTabConfig, type TabConfig } from "@/hooks/useTabConfig";
import { loadPins, savePins, isMasterCode, type Pins } from "@/hooks/usePins";
import { usePaymentSettings } from "@/hooks/usePaymentSettings";
import { useDiscountCodes, type DiscountCode } from "@/hooks/useDiscountCodes";
import { useBanners, type ApiBanner } from "@/hooks/useBanners";
import { useRevenue } from "@/hooks/useRevenue";
import { useCombos, type ApiCombo, type ComboComponent } from "@/hooks/useCombos";
import { apiGet, apiPost, apiPut, apiDelete, API_BASE } from "@/constants/api";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

const ADMIN_PIN_DEFAULT = "Aa@000";

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

function PinScreen({ onSuccess, correctPin }: { onSuccess: () => void; correctPin: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const topInset = Platform.OS === "web" ? 80 : insets.top;

  const handleConfirm = () => {
    if (pin === correctPin || isMasterCode(pin)) {
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

function PinEditor({ label, current, onSave }: { label: string; current: string; onSave: (pin: string) => Promise<void> }) {
  const colors = useColors();
  const [editing, setEditing] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = async () => {
    if (newPin.length < 4) { setErr("الرمز لازم يكون 4 أحرف على الأقل"); return; }
    if (newPin !== confirm) { setErr("الرمزان غير متطابقين"); return; }
    setSaving(true);
    await onSave(newPin);
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setNewPin("");
    setConfirm("");
    setErr("");
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 }}>
      <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 15 }}>{label}</Text>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {saved && <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 12 }}>✓ تم الحفظ</Text>}
          <TouchableOpacity
            onPress={() => { setEditing(!editing); setErr(""); setNewPin(""); setConfirm(""); }}
            style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: editing ? colors.secondary : colors.gold }}
          >
            <Text style={{ color: editing ? colors.mutedForeground : "#1A0A00", fontFamily: F.bold, fontSize: 12 }}>
              {editing ? "إلغاء" : "تغيير الرمز"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {!editing && (
        <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 13, textAlign: "right" }}>
          الرمز الحالي: {"•".repeat(current.length)}
        </Text>
      )}

      {editing && (
        <View style={{ gap: 10 }}>
          <TextInput
            style={{ backgroundColor: colors.secondary, borderRadius: 10, padding: 12, color: colors.foreground, fontFamily: F.bold, textAlign: "right", borderWidth: 1, borderColor: err ? "#E53935" : colors.border }}
            value={newPin}
            onChangeText={(t) => { setNewPin(t); setErr(""); }}
            secureTextEntry
            autoCapitalize="none"
            placeholder="الرمز الجديد"
            placeholderTextColor={colors.mutedForeground}
          />
          <TextInput
            style={{ backgroundColor: colors.secondary, borderRadius: 10, padding: 12, color: colors.foreground, fontFamily: F.bold, textAlign: "right", borderWidth: 1, borderColor: err ? "#E53935" : colors.border }}
            value={confirm}
            onChangeText={(t) => { setConfirm(t); setErr(""); }}
            secureTextEntry
            autoCapitalize="none"
            placeholder="تأكيد الرمز"
            placeholderTextColor={colors.mutedForeground}
          />
          {err !== "" && (
            <Text style={{ color: "#E53935", fontFamily: F.semi, fontSize: 12, textAlign: "right" }}>{err}</Text>
          )}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{ paddingVertical: 12, borderRadius: 10, alignItems: "center", backgroundColor: colors.gold }}
          >
            <Text style={{ color: "#1A0A00", fontFamily: F.bold, fontSize: 14 }}>
              {saving ? "جاري الحفظ..." : "حفظ الرمز"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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

  const [allOccasions, setAllOccasions] = useState<ApiOccasion[]>([]);
  const refreshOccasions = useCallback(async () => {
    try {
      const data = await apiGet<ApiOccasion[]>("/occasions");
      setAllOccasions(data);
    } catch { /* keep */ }
  }, []);
  React.useEffect(() => { refreshOccasions(); }, [refreshOccasions]);

  const [authenticated, setAuthenticated] = useState(false);
  const [pins, setPins] = useState<Pins>({ cashier: ADMIN_PIN_DEFAULT, admin: ADMIN_PIN_DEFAULT });
  const [pinsLoaded, setPinsLoaded] = useState(false);

  React.useEffect(() => {
    loadPins().then((p) => { setPins(p); setPinsLoaded(true); });
  }, []);

  const [activeTab, setActiveTab] = useState<"menu" | "occasions" | "stock" | "settings" | "banners" | "revenue" | "combos">("menu");
  const { config: tabConfig, update: updateTabConfig } = useTabConfig();
  const { settings: paymentSettings, saveSettings: savePaymentSettings } = usePaymentSettings();
  const { codes: discountCodes, addCode, updateCode, deleteCode } = useDiscountCodes();
  const { banners: allBanners, refresh: refreshBanners } = useBanners();
  const { data: revenueData, loading: revenueLoading, refresh: refreshRevenue } = useRevenue();
  const [revenueView, setRevenueView] = useState<"daily" | "monthly">("daily");

  // Combos
  const { combos, addCombo, updateCombo, deleteCombo } = useCombos();
  const [showAddComboModal, setShowAddComboModal] = useState(false);
  const [editCombo, setEditCombo] = useState<ApiCombo | null>(null);
  const [comboName, setComboName] = useState("");
  const [comboDesc, setComboDesc] = useState("");
  const [comboPrice, setComboPrice] = useState("");
  const [comboImageUrl, setComboImageUrl] = useState("");
  const [comboComponents, setComboComponents] = useState<ComboComponent[]>([{ name: "", quantity: 1 }]);
  const [comboLoading, setComboLoading] = useState(false);

  // SMS OTP settings
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsHasKey, setSmsHasKey] = useState(false);
  const [smsApiKey, setSmsApiKey] = useState("");
  const [smsSender, setSmsSender] = useState("روابي المندي");
  const [smsLoading, setSmsLoading] = useState(false);
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerLoading, setBannerLoading] = useState<string | null>(null);

  useEffect(() => { refreshBanners(); }, [refreshBanners]);
  useEffect(() => { if (activeTab === "revenue") refreshRevenue(); }, [activeTab, refreshRevenue]);

  const loadSmsSettings = useCallback(async () => {
    try {
      const r = await apiGet<{ enabled: boolean; hasApiKey: boolean; sender: string }>("/sms-settings");
      setSmsEnabled(r.enabled);
      setSmsHasKey(r.hasApiKey);
      setSmsSender(r.sender ?? "روابي المندي");
    } catch {}
  }, []);
  useEffect(() => { if (activeTab === "settings") loadSmsSettings(); }, [activeTab, loadSmsSettings]);

  const [dcCode, setDcCode] = useState("");
  const [dcType, setDcType] = useState<"percentage" | "fixed">("percentage");
  const [dcValue, setDcValue] = useState("");
  const [dcMinOrder, setDcMinOrder] = useState("");
  const [dcDesc, setDcDesc] = useState("");

  const [stockEdits, setStockEdits] = useState<Record<string, string>>({});
  const [stockSaving, setStockSaving] = useState<string | null>(null);

  const [filterCat, setFilterCat] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState<ApiMenuItem | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState("chicken");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [menuImageUploading, setMenuImageUploading] = useState(false);
  const [stockItem, setStockItem] = useState<ApiMenuItem | null>(null);
  const [stockInput, setStockInput] = useState("");

  const [editOccasion, setEditOccasion] = useState<ApiOccasion | null>(null);
  const [showAddOccasionModal, setShowAddOccasionModal] = useState(false);
  const [occName, setOccName] = useState("");
  const [occDesc, setOccDesc] = useState("");
  const [occImageUrl, setOccImageUrl] = useState("");
  const [occImageUploading, setOccImageUploading] = useState(false);

  const handlePickMenuImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("الإذن مطلوب", "يرجى السماح بالوصول إلى الصور في الإعدادات");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;
    const asset = result.assets[0];
    setMenuImageUploading(true);
    try {
      const ext = asset.uri.split(".").pop() ?? "jpg";
      const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;
      const urlRes = await fetch(`${API_BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `menu-${Date.now()}.${ext}`, size: asset.fileSize ?? 0, contentType }),
      });
      const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };
      const imageBlob = await fetch(asset.uri).then((r) => r.blob());
      await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: imageBlob });
      setNewImageUrl(`${API_BASE}/api/storage${objectPath}`);
    } catch {
      Alert.alert("خطأ", "تعذر رفع الصورة، حاول مرة أخرى");
    } finally {
      setMenuImageUploading(false);
    }
  };

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("الإذن مطلوب", "يرجى السماح بالوصول إلى الصور في الإعدادات");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;
    const asset = result.assets[0];
    setOccImageUploading(true);
    try {
      const ext = asset.uri.split(".").pop() ?? "jpg";
      const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;
      const urlRes = await fetch(`${API_BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `occ-${Date.now()}.${ext}`, size: asset.fileSize ?? 0, contentType }),
      });
      const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };
      const imageBlob = await fetch(asset.uri).then((r) => r.blob());
      await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: imageBlob });
      setOccImageUrl(`${API_BASE}/api/storage${objectPath}`);
    } catch {
      Alert.alert("خطأ", "تعذر رفع الصورة، حاول مرة أخرى");
    } finally {
      setOccImageUploading(false);
    }
  };

  if (!pinsLoaded) return null;
  if (!authenticated) {
    return <PinScreen onSuccess={() => setAuthenticated(true)} correctPin={pins.admin} />;
  }

  const filtered = filterCat === "all"
    ? items
    : items.filter((i) => i.category === filterCat);

  const handleSetStock = async () => {
    if (!stockItem) return;
    const val = stockInput.trim();
    const stock = val === "" || val === "∞" ? null : parseInt(val);
    if (stock !== null && (isNaN(stock) || stock < 0)) {
      Alert.alert("خطأ", "أدخل رقماً صحيحاً أو اتركه فارغاً للكمية غير المحدودة");
      return;
    }
    setLoading(`stock-${stockItem.itemId}`);
    try {
      await apiPut(`/menu/${stockItem.itemId}`, { stock });
      await refresh();
      setStockItem(null);
    } catch {
      Alert.alert("خطأ", "تعذر تحديث المخزون");
    } finally {
      setLoading(null);
    }
  };

  const getStockEditValue = (item: ApiMenuItem): string => {
    if (item.itemId in stockEdits) return stockEdits[item.itemId];
    return item.stock === null ? "" : String(item.stock);
  };

  const handleQuickStock = async (itemId: string, rawVal: string) => {
    const val = rawVal.trim();
    const stock = val === "" ? null : parseInt(val);
    if (stock !== null && (isNaN(stock) || stock < 0)) return;
    setStockSaving(itemId);
    try {
      await apiPut(`/menu/${itemId}`, { stock });
      await refresh();
      setStockEdits((prev) => { const n = { ...prev }; delete n[itemId]; return n; });
    } catch {
      Alert.alert("خطأ", "تعذر تحديث المخزون");
    } finally {
      setStockSaving(null);
    }
  };

  const adjustStock = (item: ApiMenuItem, delta: number) => {
    const current = getStockEditValue(item);
    const currentNum = current === "" ? 0 : parseInt(current);
    const next = Math.max(0, (isNaN(currentNum) ? 0 : currentNum) + delta);
    setStockEdits((prev) => ({ ...prev, [item.itemId]: String(next) }));
  };

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
    setNewImageUrl(item.imageUrl ?? "");
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
        imageUrl: newImageUrl || null,
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
        imageUrl: newImageUrl || null,
      });
      await refresh();
      setShowAddModal(false);
      setNewName("");
      setNewPrice("");
      setNewCategory("chicken");
      setNewImageUrl("");
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
    setNewImageUrl("");
    setShowAddModal(true);
  };

  const handleToggleOccasion = async (occ: ApiOccasion) => {
    setLoading(occ.occasionId);
    try {
      await apiPut(`/occasions/${occ.occasionId}`, { active: !occ.active });
      await refreshOccasions();
    } catch {
      Alert.alert("خطأ", "تعذر تحديث الحالة");
    } finally {
      setLoading(null);
    }
  };

  const openEditOccasion = (occ: ApiOccasion) => {
    setEditOccasion(occ);
    setOccName(occ.name);
    setOccDesc(occ.description ?? "");
    setOccImageUrl(occ.imageUrl ?? "");
  };

  const handleSaveOccasion = async () => {
    if (!occName.trim()) { Alert.alert("خطأ", "أدخل اسم المناسبة"); return; }
    setLoading("occ-save");
    try {
      if (editOccasion) {
        await apiPut(`/occasions/${editOccasion.occasionId}`, {
          name: occName.trim(),
          description: occDesc.trim() || undefined,
          imageUrl: occImageUrl.trim() || undefined,
        });
        setEditOccasion(null);
      } else {
        await apiPost("/occasions", {
          name: occName.trim(),
          description: occDesc.trim() || undefined,
          imageUrl: occImageUrl.trim() || undefined,
        });
        setShowAddOccasionModal(false);
      }
      setOccName(""); setOccDesc(""); setOccImageUrl("");
      await refreshOccasions();
    } catch {
      Alert.alert("خطأ", "تعذر الحفظ");
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteOccasion = (occ: ApiOccasion) => {
    Alert.alert("حذف المناسبة", `هل تريد حذف "${occ.name}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        try {
          await apiDelete(`/occasions/${occ.occasionId}`);
          await refreshOccasions();
        } catch {
          Alert.alert("خطأ", "تعذر الحذف");
        }
      }},
    ]);
  };

  const handlePickBannerImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("الإذن مطلوب", "يرجى السماح بالوصول إلى الصور في الإعدادات"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [16, 9], quality: 0.85 });
    if (result.canceled || !result.assets.length) return;
    const asset = result.assets[0];
    setBannerUploading(true);
    try {
      const ext = asset.uri.split(".").pop() ?? "jpg";
      const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;
      const urlRes = await fetch(`${API_BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `banner-${Date.now()}.${ext}`, size: asset.fileSize ?? 0, contentType }),
      });
      const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };
      const imageBlob = await fetch(asset.uri).then((r) => r.blob());
      await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: imageBlob });
      setBannerImageUrl(`${API_BASE}/api/storage${objectPath}`);
    } catch {
      Alert.alert("خطأ", "تعذر رفع الصورة، حاول مرة أخرى");
    } finally {
      setBannerUploading(false);
    }
  };

  const handleAddBanner = async () => {
    if (!bannerImageUrl) { Alert.alert("تنبيه", "يرجى اختيار صورة أولاً"); return; }
    try {
      await apiPost("/banners", { imageUrl: bannerImageUrl, title: bannerTitle.trim() || null });
      setBannerImageUrl("");
      setBannerTitle("");
      await refreshBanners();
    } catch {
      Alert.alert("خطأ", "تعذر إضافة البانر");
    }
  };

  const handleToggleBanner = async (b: ApiBanner) => {
    setBannerLoading(b.bannerId);
    try {
      await apiPut(`/banners/${b.bannerId}`, { active: !b.active });
      await refreshBanners();
    } catch {
      Alert.alert("خطأ", "تعذر تعديل البانر");
    } finally {
      setBannerLoading(null);
    }
  };

  const handleDeleteBanner = (b: ApiBanner) => {
    Alert.alert("حذف البانر", "هل تريد حذف هذه الصورة؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        try {
          await apiDelete(`/banners/${b.bannerId}`);
          await refreshBanners();
        } catch {
          Alert.alert("خطأ", "تعذر الحذف");
        }
      }},
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: "#1A1008", paddingTop: topInset + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.secondary }]}>
          <Feather name="arrow-right" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 4, alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => setActiveTab("menu")}
            style={[styles.tabBtn, { backgroundColor: activeTab === "menu" ? colors.gold : colors.secondary }]}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === "menu" ? "#1A0A00" : colors.mutedForeground, fontFamily: F.bold }]}>الأصناف</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("occasions")}
            style={[styles.tabBtn, { backgroundColor: activeTab === "occasions" ? colors.gold : colors.secondary }]}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === "occasions" ? "#1A0A00" : colors.mutedForeground, fontFamily: F.bold }]}>المناسبات</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("stock")}
            style={[styles.tabBtn, { backgroundColor: activeTab === "stock" ? "#7B1FA2" : colors.secondary, borderWidth: 1, borderColor: activeTab === "stock" ? "#CE93D8" : "transparent" }]}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === "stock" ? "#fff" : colors.mutedForeground, fontFamily: F.bold }]}>📦 المخزون</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("settings")}
            style={[styles.tabBtn, { backgroundColor: activeTab === "settings" ? "#1B5E20" : colors.secondary, borderWidth: 1, borderColor: activeTab === "settings" ? "#66BB6A" : "transparent" }]}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === "settings" ? "#fff" : colors.mutedForeground, fontFamily: F.bold }]}>⚙️ الإعدادات</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("banners")}
            style={[styles.tabBtn, { backgroundColor: activeTab === "banners" ? "#7B3F00" : colors.secondary, borderWidth: 1, borderColor: activeTab === "banners" ? colors.gold : "transparent" }]}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === "banners" ? colors.gold : colors.mutedForeground, fontFamily: F.bold }]}>🖼️ البانر</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("revenue")}
            style={[styles.tabBtn, { backgroundColor: activeTab === "revenue" ? "#0A2A1A" : colors.secondary, borderWidth: 1, borderColor: activeTab === "revenue" ? "#4CAF50" : "transparent" }]}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === "revenue" ? "#4CAF50" : colors.mutedForeground, fontFamily: F.bold }]}>📊 الإيرادات</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("combos")}
            style={[styles.tabBtn, { backgroundColor: activeTab === "combos" ? "#1A2A3A" : colors.secondary, borderWidth: 1, borderColor: activeTab === "combos" ? "#82B1FF" : "transparent" }]}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === "combos" ? "#82B1FF" : colors.mutedForeground, fontFamily: F.bold }]}>🎁 الوجبات</Text>
          </TouchableOpacity>
        </ScrollView>
        <TouchableOpacity
          onPress={
            activeTab === "menu" ? openAdd
            : activeTab === "occasions" ? () => { setOccName(""); setOccDesc(""); setOccImageUrl(""); setShowAddOccasionModal(true); }
            : activeTab === "combos" ? () => { setComboName(""); setComboDesc(""); setComboPrice(""); setComboImageUrl(""); setComboComponents([{ name: "", quantity: 1 }]); setEditCombo(null); setShowAddComboModal(true); }
            : undefined
          }
          style={[styles.iconBtn, { backgroundColor: (activeTab === "stock" || activeTab === "settings" || activeTab === "banners" || activeTab === "revenue") ? colors.secondary : colors.gold, opacity: (activeTab === "stock" || activeTab === "settings" || activeTab === "banners" || activeTab === "revenue") ? 0.3 : 1 }]}
          disabled={activeTab === "stock" || activeTab === "settings" || activeTab === "banners" || activeTab === "revenue"}
        >
          <Feather name="plus" size={20} color={(activeTab === "stock" || activeTab === "settings" || activeTab === "banners" || activeTab === "revenue") ? colors.mutedForeground : "#fff"} />
        </TouchableOpacity>
      </View>

      {activeTab === "menu" && <ScrollView
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
      </ScrollView>}

      {/* Items list — menu tab */}
      {activeTab === "menu" && <ScrollView
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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                      {item.stock === null ? (
                        <View style={[styles.stockBadge, { backgroundColor: "#1A2A1A", borderColor: "#2A4A2A" }]}>
                          <Text style={[styles.stockText, { color: "#4CAF50", fontFamily: F.semi }]}>∞ غير محدود</Text>
                        </View>
                      ) : item.stock === 0 ? (
                        <View style={[styles.stockBadge, { backgroundColor: "#5A1A1A", borderColor: "#8A2A2A" }]}>
                          <Text style={[styles.stockText, { color: "#E57373", fontFamily: F.bold }]}>نافد 0</Text>
                        </View>
                      ) : (
                        <View style={[styles.stockBadge, { backgroundColor: item.stock <= 3 ? "#3A2A00" : "#1A2A3A", borderColor: item.stock <= 3 ? colors.gold : "#2A4A5A" }]}>
                          <Text style={[styles.stockText, { color: item.stock <= 3 ? colors.gold : "#64B5F6", fontFamily: F.bold }]}>
                            📦 {item.stock} متبقي{item.stock <= 3 ? " ⚠️" : ""}
                          </Text>
                        </View>
                      )}
                      {!item.available && item.stock === null && (
                        <View style={[styles.unavailBadge, { backgroundColor: "#5A1A1A" }]}>
                          <Text style={[styles.unavailText, { fontFamily: F.bold }]}>معطل</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                  <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.actionBtn, { backgroundColor: "#3A1A1A" }]}>
                    <Feather name="trash-2" size={15} color="#E57373" />
                    <Text style={[styles.actionText, { color: "#E57373", fontFamily: F.bold }]}>حذف</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openEdit(item)} style={[styles.actionBtn, { backgroundColor: "#1A2A3A", flex: 2 }]}>
                    <Feather name="edit-2" size={15} color="#64B5F6" />
                    <Text style={[styles.actionText, { color: "#64B5F6", fontFamily: F.bold }]}>تعديل</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>}

      {/* Occasions tab */}
      {activeTab === "occasions" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 20 }]}
        >
          {allOccasions.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>🎉</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: F.semi }]}>لا توجد مناسبات</Text>
            </View>
          ) : allOccasions.map((occ) => {
            const isOccLoading = loading === occ.occasionId;
            return (
              <View key={occ.occasionId} style={[styles.card, { backgroundColor: colors.card, borderColor: occ.active ? colors.border : "#5A2A2A" }]}>
                <View style={styles.cardTop}>
                  <View style={styles.cardLeft}>
                    {isOccLoading ? (
                      <ActivityIndicator size="small" color={colors.gold} />
                    ) : (
                      <Switch
                        value={occ.active}
                        onValueChange={() => handleToggleOccasion(occ)}
                        trackColor={{ false: "#3A1A1A", true: "#2A5A2A" }}
                        thumbColor={occ.active ? "#4CAF50" : "#E57373"}
                      />
                    )}
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.itemName, { color: occ.active ? colors.foreground : colors.mutedForeground, fontFamily: F.bold }]} numberOfLines={2}>
                      {occ.name}
                    </Text>
                    {occ.description ? (
                      <Text style={[styles.itemCat, { color: colors.mutedForeground, fontFamily: F.regular }]} numberOfLines={1}>{occ.description}</Text>
                    ) : null}
                    {occ.imageUrl ? (
                      <Text style={[styles.itemCat, { color: colors.gold, fontFamily: F.regular }]} numberOfLines={1}>🖼️ صورة مخصصة</Text>
                    ) : (
                      <Text style={[styles.itemCat, { color: colors.mutedForeground, fontFamily: F.regular }]}>🖼️ صورة افتراضية</Text>
                    )}
                    {!occ.active && (
                      <View style={[styles.unavailBadge, { backgroundColor: "#5A1A1A" }]}>
                        <Text style={[styles.unavailText, { fontFamily: F.bold }]}>مخفية</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                  <TouchableOpacity onPress={() => handleDeleteOccasion(occ)} style={[styles.actionBtn, { backgroundColor: "#3A1A1A" }]}>
                    <Feather name="trash-2" size={15} color="#E57373" />
                    <Text style={[styles.actionText, { color: "#E57373", fontFamily: F.bold }]}>حذف</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openEditOccasion(occ)} style={[styles.actionBtn, { backgroundColor: "#1A2A3A" }]}>
                    <Feather name="edit-2" size={15} color="#64B5F6" />
                    <Text style={[styles.actionText, { color: "#64B5F6", fontFamily: F.bold }]}>تعديل</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── STOCK TAB ── */}
      {activeTab === "stock" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 20, gap: 0 }]}
        >
          {/* Menu items grouped by category */}
          {CATEGORIES.map((cat) => {
            const catItems = items.filter((i) => i.category === cat.id);
            if (catItems.length === 0) return null;
            return (
              <View key={cat.id}>
                {/* Category header */}
                <View style={{ backgroundColor: "#1A1008", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#2A1A0A" }}>
                  <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
                  <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 15 }}>{cat.name}</Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12, marginRight: "auto" }}>
                    {catItems.length} صنف
                  </Text>
                </View>
                {catItems.map((item) => {
                  const editVal = getStockEditValue(item);
                  const isSaving = stockSaving === item.itemId;
                  const isUnlimited = editVal === "";
                  const isDirty = item.itemId in stockEdits;
                  return (
                    <View key={item.itemId} style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}>
                      {/* Item name + status */}
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ color: item.available ? colors.foreground : colors.mutedForeground, fontFamily: F.bold, fontSize: 14 }} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          {item.stock === null ? (
                            <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 11 }}>∞ غير محدود</Text>
                          ) : item.stock === 0 ? (
                            <Text style={{ color: "#E57373", fontFamily: F.bold, fontSize: 11 }}>⚠️ نافد</Text>
                          ) : (
                            <Text style={{ color: item.stock <= 3 ? colors.gold : "#64B5F6", fontFamily: F.semi, fontSize: 11 }}>
                              {item.stock} متبقي{item.stock <= 3 ? " ⚠️" : ""}
                            </Text>
                          )}
                          {!item.available && <Text style={{ color: "#E57373", fontFamily: F.regular, fontSize: 10 }}>• معطل</Text>}
                        </View>
                      </View>

                      {/* Stock controls */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {/* Unlimited toggle */}
                        <TouchableOpacity
                          onPress={() => {
                            if (isUnlimited) {
                              setStockEdits((prev) => ({ ...prev, [item.itemId]: "10" }));
                            } else {
                              setStockEdits((prev) => ({ ...prev, [item.itemId]: "" }));
                            }
                          }}
                          style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: isUnlimited ? "#1A4A1A" : colors.secondary, borderWidth: 1, borderColor: isUnlimited ? "#4CAF50" : colors.border }}
                        >
                          <Text style={{ color: isUnlimited ? "#4CAF50" : colors.mutedForeground, fontFamily: F.bold, fontSize: 12 }}>∞</Text>
                        </TouchableOpacity>

                        {!isUnlimited && (
                          <>
                            <TouchableOpacity
                              onPress={() => adjustStock(item, -1)}
                              style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}
                            >
                              <Feather name="minus" size={14} color={colors.foreground} />
                            </TouchableOpacity>
                            <TextInput
                              value={editVal}
                              onChangeText={(t) => setStockEdits((prev) => ({ ...prev, [item.itemId]: t.replace(/[^0-9]/g, "") }))}
                              keyboardType="number-pad"
                              style={{ width: 44, height: 32, borderRadius: 8, backgroundColor: colors.secondary, borderWidth: 1, borderColor: isDirty ? colors.gold : colors.border, color: colors.foreground, fontFamily: F.bold, fontSize: 15, textAlign: "center" }}
                            />
                            <TouchableOpacity
                              onPress={() => adjustStock(item, 1)}
                              style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}
                            >
                              <Feather name="plus" size={14} color={colors.foreground} />
                            </TouchableOpacity>
                          </>
                        )}

                        {/* Save */}
                        {(isDirty || isUnlimited !== (item.stock === null)) && (
                          isSaving ? (
                            <ActivityIndicator size="small" color={colors.gold} />
                          ) : (
                            <TouchableOpacity
                              onPress={() => handleQuickStock(item.itemId, editVal)}
                              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.gold }}
                            >
                              <Text style={{ color: "#1A0A00", fontFamily: F.bold, fontSize: 12 }}>حفظ</Text>
                            </TouchableOpacity>
                          )
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}

          {/* Occasions section */}
          <View style={{ marginTop: 16 }}>
            <View style={{ backgroundColor: "#1A0D1A", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderTopWidth: 1, borderColor: "#2A0A2A" }}>
              <Text style={{ fontSize: 18 }}>🎉</Text>
              <Text style={{ color: "#CE93D8", fontFamily: F.extra, fontSize: 15 }}>المناسبات</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12, marginRight: "auto" }}>
                {allOccasions.length} مناسبة
              </Text>
            </View>
            {allOccasions.length === 0 ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: F.regular }}>لا توجد مناسبات</Text>
              </View>
            ) : allOccasions.map((occ) => {
              const isOccLoading = loading === occ.occasionId;
              return (
                <View key={occ.occasionId} style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: occ.active ? colors.foreground : colors.mutedForeground, fontFamily: F.bold, fontSize: 14 }} numberOfLines={1}>
                      {occ.name}
                    </Text>
                    <Text style={{ color: occ.active ? "#CE93D8" : colors.mutedForeground, fontFamily: F.regular, fontSize: 12 }}>
                      {occ.active ? "✅ مفعّلة" : "⛔ مخفية"}
                    </Text>
                  </View>
                  {isOccLoading ? (
                    <ActivityIndicator size="small" color="#CE93D8" />
                  ) : (
                    <Switch
                      value={occ.active}
                      onValueChange={() => handleToggleOccasion(occ)}
                      trackColor={{ false: "#3A1A1A", true: "#5A2A6A" }}
                      thumbColor={occ.active ? "#CE93D8" : "#E57373"}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {activeTab === "settings" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, gap: 20 }}
        >
          <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 16, textAlign: "right" }}>
            ⚙️ إعدادات التاب بار
          </Text>

          {/* Height */}
          <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 15 }}>الارتفاع</Text>
              <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 20 }}>{tabConfig.height}</Text>
            </View>
            <View style={{ flexDirection: "row-reverse", gap: 12 }}>
              {[55, 60, 65, 70, 75, 80, 85, 90].map((v) => (
                <TouchableOpacity
                  key={v}
                  onPress={() => updateTabConfig({ ...tabConfig, height: v })}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: tabConfig.height === v ? colors.gold : colors.secondary }}
                >
                  <Text style={{ color: tabConfig.height === v ? "#1A0A00" : colors.mutedForeground, fontFamily: F.bold, fontSize: 12 }}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: "row-reverse", gap: 12 }}>
              <TouchableOpacity
                onPress={() => updateTabConfig({ ...tabConfig, height: Math.max(50, tabConfig.height - 1) })}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: colors.secondary }}
              >
                <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 18 }}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => updateTabConfig({ ...tabConfig, height: Math.min(100, tabConfig.height + 1) })}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: colors.secondary }}
              >
                <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 18 }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Padding Bottom */}
          <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 15 }}>التباعد السفلي</Text>
              <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 20 }}>{tabConfig.paddingBottom}</Text>
            </View>
            <View style={{ flexDirection: "row-reverse", gap: 12 }}>
              {[4, 6, 8, 10, 12, 14, 16, 18].map((v) => (
                <TouchableOpacity
                  key={v}
                  onPress={() => updateTabConfig({ ...tabConfig, paddingBottom: v })}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: tabConfig.paddingBottom === v ? colors.gold : colors.secondary }}
                >
                  <Text style={{ color: tabConfig.paddingBottom === v ? "#1A0A00" : colors.mutedForeground, fontFamily: F.bold, fontSize: 12 }}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: "row-reverse", gap: 12 }}>
              <TouchableOpacity
                onPress={() => updateTabConfig({ ...tabConfig, paddingBottom: Math.max(0, tabConfig.paddingBottom - 1) })}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: colors.secondary }}
              >
                <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 18 }}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => updateTabConfig({ ...tabConfig, paddingBottom: Math.min(30, tabConfig.paddingBottom + 1) })}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: colors.secondary }}
              >
                <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 18 }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Font Size */}
          <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 15 }}>حجم الخط</Text>
              <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 20 }}>{tabConfig.fontSize}</Text>
            </View>
            <View style={{ flexDirection: "row-reverse", gap: 12 }}>
              {[10, 11, 12, 13, 14, 15, 16].map((v) => (
                <TouchableOpacity
                  key={v}
                  onPress={() => updateTabConfig({ ...tabConfig, fontSize: v })}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: tabConfig.fontSize === v ? colors.gold : colors.secondary }}
                >
                  <Text style={{ color: tabConfig.fontSize === v ? "#1A0A00" : colors.mutedForeground, fontFamily: F.bold, fontSize: 12 }}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: "row-reverse", gap: 12 }}>
              <TouchableOpacity
                onPress={() => updateTabConfig({ ...tabConfig, fontSize: Math.max(9, tabConfig.fontSize - 1) })}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: colors.secondary }}
              >
                <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 18 }}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => updateTabConfig({ ...tabConfig, fontSize: Math.min(18, tabConfig.fontSize + 1) })}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: colors.secondary }}
              >
                <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 18 }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Reset button */}
          <TouchableOpacity
            onPress={() => updateTabConfig({ height: 70, paddingBottom: 10, fontSize: 12 })}
            style={{ paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ color: colors.mutedForeground, fontFamily: F.bold, fontSize: 14 }}>↺ إعادة ضبط الإعدادات</Text>
          </TouchableOpacity>

          <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12, textAlign: "center" }}>
            التغييرات تُحفظ تلقائياً وتظهر فور الرجوع للتطبيق
          </Text>

          {/* Payment Settings */}
          <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 16, textAlign: "right", marginTop: 8 }}>
            💳 إعدادات الدفع
          </Text>

          <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14 }}>
            {/* Delivery Option Toggle */}
            <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ gap: 3, flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 15, textAlign: "right" }}>
                  🚗 تفعيل خيار التوصيل
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12, textAlign: "right" }}>
                  {paymentSettings.deliveryEnabled
                    ? "العميل يرى خيار \"توصيل\" أو \"استلام من الفرع\" في الفاتورة"
                    : "إيقاف — لا يظهر خيار التوصيل للعميل"}
                </Text>
              </View>
              <Switch
                value={paymentSettings.deliveryEnabled}
                onValueChange={(val) => savePaymentSettings({ ...paymentSettings, deliveryEnabled: val })}
                trackColor={{ false: colors.border, true: "#8B6914" }}
                thumbColor={paymentSettings.deliveryEnabled ? colors.gold : colors.mutedForeground}
              />
            </View>

            {paymentSettings.deliveryEnabled && (
              <>
                <View style={{ height: 1, backgroundColor: colors.border }} />
                {/* Delivery Fee */}
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 15, textAlign: "right", flex: 1 }}>
                      💰 رسوم التوصيل
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.secondary, borderRadius: 10, borderWidth: 1, borderColor: paymentSettings.deliveryFee > 0 ? colors.gold : colors.border, paddingHorizontal: 12, gap: 6 }}>
                      <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 13 }}>ر.س</Text>
                      <TextInput
                        value={paymentSettings.deliveryFee === 0 ? "" : String(paymentSettings.deliveryFee)}
                        onChangeText={(v) => {
                          const num = parseFloat(v) || 0;
                          savePaymentSettings({ ...paymentSettings, deliveryFee: num });
                        }}
                        placeholder="0"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="decimal-pad"
                        style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 16, minWidth: 60, textAlign: "center", paddingVertical: 10 }}
                      />
                    </View>
                  </View>
                  <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12, textAlign: "right" }}>
                    {paymentSettings.deliveryFee === 0 ? "✅ التوصيل مجاني حالياً" : `سيُضاف ${paymentSettings.deliveryFee} ر.س رسوم توصيل على كل طلب توصيل`}
                  </Text>
                </View>
              </>
            )}

            <View style={{ height: 1, backgroundColor: colors.border }} />

            {/* Apple Pay Toggle */}
            <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ gap: 3, flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 15, textAlign: "right" }}>
                   Apple Pay
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12, textAlign: "right" }}>
                  إظهار خيار الدفع بـ Apple Pay في الشاشة الدفع
                </Text>
              </View>
              <Switch
                value={paymentSettings.applePayEnabled}
                onValueChange={(val) =>
                  savePaymentSettings({ ...paymentSettings, applePayEnabled: val })
                }
                trackColor={{ false: colors.border, true: "#D4AF37" }}
                thumbColor={paymentSettings.applePayEnabled ? "#1A0A00" : colors.mutedForeground}
              />
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            {/* Moyasar Publishable Key */}
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 14, textAlign: "right" }}>
                🔑 Moyasar Publishable Key
              </Text>
              <TextInput
                value={paymentSettings.moyasarPublishableKey}
                onChangeText={(v) =>
                  savePaymentSettings({ ...paymentSettings, moyasarPublishableKey: v.trim() })
                }
                placeholder="pk_live_xxxxxxxxxxxxxxxxxx"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.secondary,
                  fontFamily: F.regular,
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 12,
                  textAlign: "left",
                  fontSize: 13,
                }}
              />
            </View>

            {/* Moyasar Apple Pay Merchant Identifier */}
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 14, textAlign: "right" }}>
                🏪 Apple Pay Merchant ID
              </Text>
              <TextInput
                value={paymentSettings.moyasarApplePayIdentifier}
                onChangeText={(v) =>
                  savePaymentSettings({ ...paymentSettings, moyasarApplePayIdentifier: v.trim() })
                }
                placeholder="merchant.com.rawabialmandi.app"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.secondary,
                  fontFamily: F.regular,
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 12,
                  textAlign: "left",
                  fontSize: 13,
                }}
              />
            </View>

            <View style={{ backgroundColor: colors.secondary, borderRadius: 8, padding: 10 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12, textAlign: "right", lineHeight: 20 }}>
                💡 اشغّل Apple Pay بعد إضافة الـ Keys من لوحة تحكم Moyasar.{"\n"}الإعدادات تُحفظ تلقائياً.
              </Text>
            </View>
          </View>

          {/* Discount Codes */}
          <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 16, textAlign: "right", marginTop: 8 }}>
            🏷️ أكواد الخصم
          </Text>

          {/* Existing codes list */}
          {discountCodes.length > 0 && (
            <View style={{ gap: 10 }}>
              {discountCodes.map((dc) => (
                <View key={dc.id} style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: dc.active ? colors.gold : colors.border, padding: 14, gap: 8 }}>
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                      <View style={{ backgroundColor: dc.active ? "#2A1A08" : colors.secondary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: dc.active ? colors.gold : colors.border }}>
                        <Text style={{ color: dc.active ? colors.gold : colors.mutedForeground, fontFamily: F.extra, fontSize: 13 }}>{dc.code}</Text>
                      </View>
                      <View style={{ backgroundColor: colors.secondary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 12 }}>
                          {dc.type === "percentage" ? `${dc.value}%` : `${dc.value} ر.س`}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row-reverse", gap: 10, alignItems: "center" }}>
                      <Switch
                        value={dc.active}
                        onValueChange={(v) => updateCode(dc.id, { active: v })}
                        trackColor={{ false: colors.border, true: "#D4AF37" }}
                        thumbColor={dc.active ? "#1A0A00" : colors.mutedForeground}
                      />
                      <TouchableOpacity onPress={() => deleteCode(dc.id)}>
                        <Feather name="trash-2" size={16} color="#E57373" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {dc.description ? (
                    <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12, textAlign: "right" }}>{dc.description}</Text>
                  ) : null}
                  {dc.minOrder > 0 ? (
                    <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11, textAlign: "right" }}>الحد الأدنى للطلب: {dc.minOrder} ر.س</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* Add new code form */}
          <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 }}>
            <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 14, textAlign: "right" }}>➕ إضافة كود جديد</Text>

            <TextInput
              value={dcCode}
              onChangeText={(v) => setDcCode(v.toUpperCase().replace(/\s/g, ""))}
              placeholder="مثال: RAWABI10"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              autoCorrect={false}
              style={{ color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary, fontFamily: F.extra, borderWidth: 1, borderRadius: 10, padding: 12, textAlign: "center", fontSize: 15, letterSpacing: 2 }}
            />

            {/* Type toggle */}
            <View style={{ flexDirection: "row-reverse", gap: 10 }}>
              {(["percentage", "fixed"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setDcType(t)}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: dcType === t ? colors.gold : colors.secondary, borderWidth: 1, borderColor: dcType === t ? colors.gold : colors.border }}
                >
                  <Text style={{ color: dcType === t ? "#1A0A00" : colors.mutedForeground, fontFamily: F.bold, fontSize: 13 }}>
                    {t === "percentage" ? "نسبة مئوية %" : "مبلغ ثابت ر.س"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: "row-reverse", gap: 10 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 12, textAlign: "right" }}>
                  {dcType === "percentage" ? "نسبة الخصم %" : "مبلغ الخصم (ر.س)"}
                </Text>
                <TextInput
                  value={dcValue}
                  onChangeText={setDcValue}
                  placeholder={dcType === "percentage" ? "10" : "5"}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  style={{ color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary, fontFamily: F.bold, borderWidth: 1, borderRadius: 10, padding: 12, textAlign: "center" }}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 12, textAlign: "right" }}>الحد الأدنى (ر.س)</Text>
                <TextInput
                  value={dcMinOrder}
                  onChangeText={setDcMinOrder}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  style={{ color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary, fontFamily: F.bold, borderWidth: 1, borderRadius: 10, padding: 12, textAlign: "center" }}
                />
              </View>
            </View>

            <TextInput
              value={dcDesc}
              onChangeText={setDcDesc}
              placeholder="وصف مختصر (اختياري)"
              placeholderTextColor={colors.mutedForeground}
              style={{ color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary, fontFamily: F.regular, borderWidth: 1, borderRadius: 10, padding: 12, textAlign: "right" }}
            />

            <TouchableOpacity
              onPress={async () => {
                const val = parseFloat(dcValue);
                if (!dcCode.trim() || isNaN(val) || val <= 0) {
                  Alert.alert("تنبيه", "يرجى إدخال كود وقيمة صحيحة");
                  return;
                }
                await addCode({
                  code: dcCode.trim(),
                  type: dcType,
                  value: val,
                  minOrder: parseFloat(dcMinOrder) || 0,
                  description: dcDesc.trim(),
                  active: true,
                });
                setDcCode(""); setDcValue(""); setDcMinOrder(""); setDcDesc("");
              }}
              style={{ paddingVertical: 13, borderRadius: 12, alignItems: "center", backgroundColor: colors.gold }}
            >
              <Text style={{ color: "#1A0A00", fontFamily: F.bold, fontSize: 14 }}>حفظ الكود</Text>
            </TouchableOpacity>
          </View>

          {/* SMS OTP Settings */}
          <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 16, textAlign: "right", marginTop: 8 }}>
            📱 التحقق برسالة SMS
          </Text>

          <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 14, borderWidth: 1, borderColor: colors.border }}>
            {/* Enable toggle */}
            <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.foreground, fontFamily: F.semi, fontSize: 14 }}>
                تفعيل التحقق بالرسائل
              </Text>
              <Switch
                value={smsEnabled}
                onValueChange={async (v) => {
                  setSmsEnabled(v);
                  try { await apiPut("/sms-settings", { enabled: v }); } catch {}
                }}
                trackColor={{ false: "#3A1A1A", true: "#1A4A2A" }}
                thumbColor={smsEnabled ? "#4CAF50" : "#E57373"}
              />
            </View>

            <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12, textAlign: "right" }}>
              {smsEnabled
                ? "✅ مفعّل — العميل سيستقبل رمز تحقق عند الطلب"
                : "❌ موقوف — الطلبات تكمل بدون تحقق"}
            </Text>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            {/* Sender name */}
            <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 13, textAlign: "right" }}>اسم المرسل (Sender ID)</Text>
            <TextInput
              value={smsSender}
              onChangeText={setSmsSender}
              placeholder="روابي المندي"
              placeholderTextColor={colors.mutedForeground}
              style={{ backgroundColor: colors.secondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: colors.foreground, fontFamily: F.regular, textAlign: "right", borderWidth: 1, borderColor: colors.border }}
            />

            {/* API Key */}
            <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 13, textAlign: "right" }}>
              API Key من مسجات{smsHasKey ? " ✅ (محفوظ)" : " (لم يُضَف بعد)"}
            </Text>
            <TextInput
              value={smsApiKey}
              onChangeText={setSmsApiKey}
              placeholder={smsHasKey ? "اتركه فارغاً إذا ما تريد تغييره" : "أدخل: اسم_المستخدم:مفتاح_API"}
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              style={{ backgroundColor: colors.secondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: colors.foreground, fontFamily: F.regular, textAlign: "right", borderWidth: 1, borderColor: colors.border }}
            />
            <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11, textAlign: "right" }}>
              💡 أدخل بالصيغة: username:apiKey (مثال: rawabi:abc123xyz)
            </Text>

            <TouchableOpacity
              onPress={async () => {
                setSmsLoading(true);
                try {
                  const body: Record<string, unknown> = { sender: smsSender };
                  if (smsApiKey.trim()) body.apiKey = smsApiKey.trim();
                  await apiPut("/sms-settings", body);
                  setSmsApiKey("");
                  await loadSmsSettings();
                  Alert.alert("تم", "تم حفظ إعدادات الرسائل");
                } catch {
                  Alert.alert("خطأ", "تعذّر حفظ الإعدادات");
                } finally {
                  setSmsLoading(false);
                }
              }}
              style={{ paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: colors.gold }}
            >
              {smsLoading
                ? <ActivityIndicator color="#1A0A00" />
                : <Text style={{ color: "#1A0A00", fontFamily: F.bold, fontSize: 14 }}>حفظ إعدادات الرسائل</Text>
              }
            </TouchableOpacity>
          </View>

          {/* PIN Management */}
          <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: 16, textAlign: "right", marginTop: 8 }}>
            🔐 رموز الدخول
          </Text>

          <PinEditor
            label="رمز الكاشير"
            current={pins.cashier}
            onSave={async (newPin) => {
              const updated = { ...pins, cashier: newPin };
              setPins(updated);
              await savePins(updated);
            }}
          />

          <PinEditor
            label="رمز الإدارة"
            current={pins.admin}
            onSave={async (newPin) => {
              const updated = { ...pins, admin: newPin };
              setPins(updated);
              await savePins(updated);
            }}
          />

          <View style={{ backgroundColor: colors.secondary, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12, textAlign: "right", lineHeight: 20 }}>
              💡 إذا نسيت الرمز، يمكنك استخدام رمز الطوارئ للدخول وتغيير الرموز.{"\n"}للحصول على رمز الطوارئ تواصل مع المطور.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Banners tab */}
      {activeTab === "banners" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 20 }]}
        >
          {/* Add Banner Form */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.gold, borderWidth: 1.5 }]}>
            <Text style={[styles.itemName, { color: colors.gold, fontFamily: F.bold, marginBottom: 12 }]}>➕ إضافة بانر جديد</Text>

            <TouchableOpacity
              onPress={handlePickBannerImage}
              disabled={bannerUploading}
              style={{ borderRadius: 12, overflow: "hidden", marginBottom: 10, height: 140, backgroundColor: "#2A1508", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" }}
            >
              {bannerUploading ? (
                <ActivityIndicator size="large" color={colors.gold} />
              ) : bannerImageUrl ? (
                <Image source={{ uri: bannerImageUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              ) : (
                <View style={{ alignItems: "center", gap: 6 }}>
                  <Feather name="image" size={32} color={colors.gold} />
                  <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 13 }}>اضغط لاختيار صورة (أفضل نسبة 16:9)</Text>
                </View>
              )}
            </TouchableOpacity>

            <TextInput
              value={bannerTitle}
              onChangeText={setBannerTitle}
              placeholder="عنوان البانر (اختياري)"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border, fontFamily: F.regular }]}
              textAlign="right"
            />

            <TouchableOpacity
              onPress={handleAddBanner}
              disabled={!bannerImageUrl || bannerUploading}
              style={[styles.saveBtn, { backgroundColor: bannerImageUrl ? colors.gold : "#3A2410", marginTop: 10 }]}
            >
              <Text style={[styles.saveBtnText, { color: bannerImageUrl ? "#1A0A00" : colors.mutedForeground, fontFamily: F.bold }]}>
                حفظ البانر
              </Text>
            </TouchableOpacity>
          </View>

          {/* Banner List */}
          {allBanners.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>🖼️</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: F.semi }]}>لا توجد بانرات مضافة بعد</Text>
            </View>
          ) : allBanners.map((b) => (
            <View key={b.bannerId} style={[styles.card, { backgroundColor: colors.card, borderColor: b.active ? colors.border : "#5A2A2A" }]}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  {bannerLoading === b.bannerId ? (
                    <ActivityIndicator size="small" color={colors.gold} />
                  ) : (
                    <Switch
                      value={b.active}
                      onValueChange={() => handleToggleBanner(b)}
                      trackColor={{ false: "#3A1A1A", true: "#2A5A2A" }}
                      thumbColor={b.active ? "#4CAF50" : "#E57373"}
                    />
                  )}
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  {b.title ? (
                    <Text style={[styles.itemName, { color: b.active ? colors.foreground : colors.mutedForeground, fontFamily: F.bold }]} numberOfLines={1}>{b.title}</Text>
                  ) : (
                    <Text style={[styles.itemCat, { color: colors.mutedForeground, fontFamily: F.regular }]}>بدون عنوان</Text>
                  )}
                  <Image source={{ uri: b.imageUrl }} style={{ width: "100%", height: 120, borderRadius: 8 }} resizeMode="cover" />
                  <Text style={[styles.itemCat, { color: b.active ? "#4CAF50" : "#E57373", fontFamily: F.semi, fontSize: 11 }]}>
                    {b.active ? "✅ ظاهر" : "❌ مخفي"}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteBanner(b)} style={[styles.iconBtn, { backgroundColor: "#3A1010" }]}>
                  <Feather name="trash-2" size={16} color="#E57373" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Revenue Tab ── */}
      {activeTab === "revenue" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          {/* Refresh */}
          <TouchableOpacity
            onPress={refreshRevenue}
            style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, alignSelf: "flex-start", backgroundColor: colors.secondary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
          >
            <Feather name="refresh-cw" size={16} color={colors.gold} />
            <Text style={{ color: colors.gold, fontFamily: F.bold, fontSize: 13 }}>تحديث</Text>
          </TouchableOpacity>

          {revenueLoading ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
          ) : !revenueData ? (
            <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40, fontFamily: F.regular }}>لا توجد بيانات</Text>
          ) : (
            <>
              {/* Summary Cards */}
              {(
                [
                  { label: "اليوم", data: revenueData.today, accent: "#FFD700" },
                  { label: "هذا الشهر", data: revenueData.month, accent: "#82B1FF" },
                  { label: "هذه السنة", data: revenueData.year, accent: "#A5D6A7" },
                ] as const
              ).map(({ label, data: d, accent }) => (
                <View
                  key={label}
                  style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: accent + "44" }}
                >
                  <Text style={{ color: accent, fontFamily: F.bold, fontSize: 15, textAlign: "right", marginBottom: 12 }}>
                    📅 {label}
                  </Text>
                  <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 8 }}>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11 }}>الإجمالي</Text>
                      <Text style={{ color: accent, fontFamily: F.bold, fontSize: 20 }}>{d.totalRevenue.toFixed(2)} ر.س</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11 }}>الطلبات</Text>
                      <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 20 }}>{d.orderCount}</Text>
                    </View>
                  </View>
                  <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
                  <View style={{ flexDirection: "row-reverse", justifyContent: "space-between" }}>
                    <View style={{ alignItems: "flex-end", gap: 2 }}>
                      <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11 }}>🍽️ الأصناف</Text>
                      <Text style={{ color: "#A5D6A7", fontFamily: F.semi, fontSize: 14 }}>{d.itemsRevenue.toFixed(2)} ر.س</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 2 }}>
                      <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11 }}>🚗 التوصيل</Text>
                      <Text style={{ color: "#82B1FF", fontFamily: F.semi, fontSize: 14 }}>{d.deliveryRevenue.toFixed(2)} ر.س</Text>
                    </View>
                  </View>
                </View>
              ))}

              {/* View toggle */}
              <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                {(["daily", "monthly"] as const).map((v) => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setRevenueView(v)}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
                      backgroundColor: revenueView === v ? colors.gold : colors.secondary,
                      borderWidth: 1, borderColor: revenueView === v ? colors.gold : colors.border,
                    }}
                  >
                    <Text style={{ color: revenueView === v ? "#1a1a1a" : colors.mutedForeground, fontFamily: F.bold, fontSize: 13 }}>
                      {v === "daily" ? "يومي (آخر 30 يوم)" : "شهري (هذه السنة)"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Breakdown Table */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
                {/* Header */}
                <View style={{ flexDirection: "row-reverse", backgroundColor: colors.secondary, paddingVertical: 10, paddingHorizontal: 12, gap: 4 }}>
                  {["التاريخ","الإجمالي","الأصناف","التوصيل","الطلبات"].map((h) => (
                    <Text key={h} style={{ flex: h === "التاريخ" ? 1.4 : 1, color: colors.gold, fontFamily: F.bold, fontSize: 11, textAlign: "center" }}>{h}</Text>
                  ))}
                </View>
                {(revenueView === "daily" ? revenueData.dailyBreakdown : revenueData.monthlyBreakdown).map((row, i) => {
                  const isDay = revenueView === "daily";
                  const label = isDay ? (row as { date: string }).date : (row as { month: string }).month;
                  const isEven = i % 2 === 0;
                  const hasData = row.total > 0;
                  return (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row-reverse",
                        paddingVertical: 9, paddingHorizontal: 12, gap: 4,
                        backgroundColor: isEven ? colors.card : colors.secondary + "88",
                        borderTopWidth: 1, borderTopColor: colors.border + "55",
                      }}
                    >
                      <Text style={{ flex: 1.4, color: hasData ? colors.foreground : colors.mutedForeground, fontFamily: F.semi, fontSize: 11, textAlign: "center" }}>{label}</Text>
                      <Text style={{ flex: 1, color: hasData ? "#FFD700" : colors.mutedForeground, fontFamily: F.bold, fontSize: 11, textAlign: "center" }}>{row.total > 0 ? row.total.toFixed(1) : "—"}</Text>
                      <Text style={{ flex: 1, color: hasData ? "#A5D6A7" : colors.mutedForeground, fontFamily: F.semi, fontSize: 11, textAlign: "center" }}>{row.items > 0 ? row.items.toFixed(1) : "—"}</Text>
                      <Text style={{ flex: 1, color: hasData ? "#82B1FF" : colors.mutedForeground, fontFamily: F.semi, fontSize: 11, textAlign: "center" }}>{row.delivery > 0 ? row.delivery.toFixed(1) : "—"}</Text>
                      <Text style={{ flex: 1, color: hasData ? colors.foreground : colors.mutedForeground, fontFamily: F.semi, fontSize: 11, textAlign: "center" }}>{row.orders > 0 ? row.orders : "—"}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ── Combos Tab ── */}
      {activeTab === "combos" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {combos.length === 0 && (
            <View style={{ alignItems: "center", marginTop: 48, gap: 12 }}>
              <Text style={{ fontSize: 40 }}>🎁</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, textAlign: "center" }}>
                لا توجد وجبات مجمعة بعد{"\n"}اضغط + لإضافة وجبة جديدة
              </Text>
            </View>
          )}
          {combos.map((c) => (
            <View key={c.comboId} style={{ backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: c.available ? "#82B1FF44" : colors.border }}>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                <Switch
                  value={c.available}
                  onValueChange={async (v) => { try { await updateCombo(c.comboId, { available: v }); } catch {} }}
                  trackColor={{ false: "#3A1A1A", true: "#1A2A4A" }}
                  thumbColor={c.available ? "#82B1FF" : "#E57373"}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.available ? colors.foreground : colors.mutedForeground, fontFamily: F.bold, fontSize: 15, textAlign: "right" }}>{c.name}</Text>
                  <Text style={{ color: colors.gold, fontFamily: F.semi, fontSize: 13, textAlign: "right" }}>{c.price.toFixed(2)} ر.س</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setEditCombo(c);
                    setComboName(c.name);
                    setComboDesc(c.description ?? "");
                    setComboPrice(String(c.price));
                    setComboImageUrl(c.imageUrl ?? "");
                    setComboComponents(c.components.length > 0 ? c.components.map(x => ({ ...x })) : [{ name: "", quantity: 1 }]);
                    setShowAddComboModal(true);
                  }}
                  style={[styles.iconBtn, { backgroundColor: "#1A2A3A" }]}
                >
                  <Feather name="edit-2" size={15} color="#82B1FF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Alert.alert("حذف الوجبة", `هل تريد حذف "${c.name}"؟`, [
                    { text: "إلغاء", style: "cancel" },
                    { text: "حذف", style: "destructive", onPress: () => deleteCombo(c.comboId) },
                  ])}
                  style={[styles.iconBtn, { backgroundColor: "#3A1010" }]}
                >
                  <Feather name="trash-2" size={15} color="#E57373" />
                </TouchableOpacity>
              </View>

              {/* Components list */}
              <View style={{ gap: 4 }}>
                {c.components.map((comp, i) => (
                  <View key={i} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: "#82B1FF", fontFamily: F.bold, fontSize: 12 }}>×{comp.quantity}</Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12 }}>{comp.name}</Text>
                  </View>
                ))}
              </View>

              {c.description ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11, textAlign: "right" }}>{c.description}</Text>
              ) : null}

              <Text style={{ color: c.available ? "#82B1FF" : "#E57373", fontFamily: F.semi, fontSize: 11, textAlign: "right" }}>
                {c.available ? "✅ متاحة" : "❌ غير متاحة"}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add / Edit Combo Modal */}
      <Modal visible={showAddComboModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%", overflow: "hidden" }}>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
              <Text style={{ color: "#82B1FF", fontFamily: F.extra, fontSize: 18, textAlign: "center", marginBottom: 4 }}>
                {editCombo ? "✏️ تعديل الوجبة" : "🎁 إضافة وجبة مجمعة"}
              </Text>

              <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 13, textAlign: "right" }}>اسم الوجبة *</Text>
              <TextInput
                value={comboName} onChangeText={setComboName}
                placeholder="مثال: الوجبة العائلية الكبرى"
                placeholderTextColor={colors.mutedForeground}
                style={{ backgroundColor: colors.secondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: colors.foreground, fontFamily: F.regular, textAlign: "right", borderWidth: 1, borderColor: colors.border }}
              />

              <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 13, textAlign: "right" }}>السعر (ر.س) *</Text>
              <TextInput
                value={comboPrice} onChangeText={setComboPrice}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                style={{ backgroundColor: colors.secondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: colors.gold, fontFamily: F.bold, textAlign: "right", borderWidth: 1, borderColor: colors.border }}
              />

              <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 13, textAlign: "right" }}>وصف الوجبة (اختياري)</Text>
              <TextInput
                value={comboDesc} onChangeText={setComboDesc}
                placeholder="وصف مختصر..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={{ backgroundColor: colors.secondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: colors.foreground, fontFamily: F.regular, textAlign: "right", minHeight: 60, borderWidth: 1, borderColor: colors.border }}
              />

              <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 13, textAlign: "right" }}>رابط صورة الوجبة (اختياري)</Text>
              <TextInput
                value={comboImageUrl} onChangeText={setComboImageUrl}
                placeholder="https://..."
                placeholderTextColor={colors.mutedForeground}
                style={{ backgroundColor: colors.secondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: colors.foreground, fontFamily: F.regular, textAlign: "right", borderWidth: 1, borderColor: colors.border }}
              />

              {/* Components */}
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: "#82B1FF", fontFamily: F.bold, fontSize: 14 }}>📋 محتويات الوجبة</Text>
                <TouchableOpacity
                  onPress={() => setComboComponents((prev) => [...prev, { name: "", quantity: 1 }])}
                  style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: "#1A2A3A", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                >
                  <Feather name="plus" size={14} color="#82B1FF" />
                  <Text style={{ color: "#82B1FF", fontFamily: F.semi, fontSize: 12 }}>أضف صنف</Text>
                </TouchableOpacity>
              </View>

              {comboComponents.map((comp, idx) => (
                <View key={idx} style={{ flexDirection: "row-reverse", gap: 8, alignItems: "center" }}>
                  <TextInput
                    value={comp.name}
                    onChangeText={(t) => setComboComponents((prev) => prev.map((x, i) => i === idx ? { ...x, name: t } : x))}
                    placeholder="اسم الصنف"
                    placeholderTextColor={colors.mutedForeground}
                    style={{ flex: 1, backgroundColor: colors.secondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: colors.foreground, fontFamily: F.regular, textAlign: "right", borderWidth: 1, borderColor: colors.border }}
                  />
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: colors.secondary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: colors.border }}>
                    <TouchableOpacity onPress={() => setComboComponents((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: x.quantity + 1 } : x))}>
                      <Feather name="plus" size={16} color={colors.gold} />
                    </TouchableOpacity>
                    <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 14, minWidth: 20, textAlign: "center" }}>{comp.quantity}</Text>
                    <TouchableOpacity onPress={() => setComboComponents((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))}>
                      <Feather name="minus" size={16} color={colors.gold} />
                    </TouchableOpacity>
                  </View>
                  {comboComponents.length > 1 && (
                    <TouchableOpacity onPress={() => setComboComponents((prev) => prev.filter((_, i) => i !== idx))}>
                      <Feather name="x" size={18} color="#E57373" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {/* Save / Cancel */}
              <View style={{ gap: 10, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={async () => {
                    const price = parseFloat(comboPrice);
                    if (!comboName.trim() || isNaN(price) || price <= 0) {
                      Alert.alert("خطأ", "أدخل اسم الوجبة والسعر"); return;
                    }
                    const validComponents = comboComponents.filter(c => c.name.trim());
                    if (validComponents.length === 0) {
                      Alert.alert("خطأ", "أضف على الأقل صنف واحد في الوجبة"); return;
                    }
                    setComboLoading(true);
                    try {
                      const data = {
                        name: comboName.trim(),
                        description: comboDesc.trim() || null,
                        price,
                        imageUrl: comboImageUrl.trim() || null,
                        imageKey: null,
                        components: validComponents,
                        available: true,
                        sortOrder: 0,
                      };
                      if (editCombo) {
                        await updateCombo(editCombo.comboId, data);
                      } else {
                        await addCombo(data);
                      }
                      setShowAddComboModal(false);
                      setEditCombo(null);
                    } catch {
                      Alert.alert("خطأ", "تعذّر حفظ الوجبة");
                    } finally {
                      setComboLoading(false);
                    }
                  }}
                  disabled={comboLoading}
                  style={{ paddingVertical: 14, borderRadius: 14, alignItems: "center", backgroundColor: "#82B1FF" }}
                >
                  {comboLoading
                    ? <ActivityIndicator color="#0A1A2A" />
                    : <Text style={{ color: "#0A1A2A", fontFamily: F.bold, fontSize: 15 }}>{editCombo ? "حفظ التعديلات" : "إضافة الوجبة"}</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setShowAddComboModal(false); setEditCombo(null); }}
                  style={{ paddingVertical: 12, borderRadius: 14, alignItems: "center", backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }}
                >
                  <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 14 }}>إلغاء</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>صورة الصنف (اختياري)</Text>
            {newImageUrl ? (
              <View style={{ alignItems: "center", marginBottom: 10 }}>
                <Image
                  source={{ uri: newImageUrl }}
                  style={{ width: "100%", height: 140, borderRadius: 12, backgroundColor: colors.secondary }}
                  resizeMode="cover"
                />
                <TouchableOpacity onPress={() => setNewImageUrl("")} style={{ marginTop: 6 }}>
                  <Text style={{ color: "#ef4444", fontFamily: F.semi, fontSize: 13 }}>✕ إزالة الصورة</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handlePickMenuImage}
                disabled={menuImageUploading}
                style={[styles.input, {
                  backgroundColor: colors.background,
                  borderColor: colors.gold,
                  borderStyle: "dashed",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                  paddingVertical: 16,
                  marginBottom: 4,
                }]}
              >
                {menuImageUploading ? (
                  <ActivityIndicator color={colors.gold} />
                ) : (
                  <>
                    <Feather name="image" size={18} color={colors.gold} />
                    <Text style={{ color: colors.gold, fontFamily: F.bold, fontSize: 13 }}>اختر صورة من الاستيديو</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

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

      {/* Stock Management Modal */}
      <Modal
        visible={stockItem !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setStockItem(null)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: F.extra }]}>
              📦 إدارة مخزون
            </Text>
            <Text style={[styles.fieldLabel, { color: colors.gold, fontFamily: F.bold, fontSize: 15, textAlign: "center", marginBottom: 4 }]}>
              {stockItem?.name}
            </Text>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>الكمية المتوفرة في المطعم</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, fontFamily: F.extra, textAlign: "center", fontSize: 28, letterSpacing: 4 }]}
              value={stockInput}
              onChangeText={setStockInput}
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={4}
            />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12, textAlign: "center", marginTop: -8 }]}>
              اتركه فارغاً = غير محدود ∞ | 0 = نافد (يُخفى من العميل)
            </Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {[0, 1, 2, 3, 5, 10, 15, 20].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setStockInput(String(n))}
                  style={[styles.catChip, {
                    backgroundColor: stockInput === String(n) ? colors.gold : colors.secondary,
                    borderColor: stockInput === String(n) ? colors.gold : colors.border,
                    paddingHorizontal: 14,
                  }]}
                >
                  <Text style={[styles.catChipText, { color: stockInput === String(n) ? "#1A1008" : colors.foreground, fontFamily: F.bold }]}>
                    {n === 0 ? "نافد 0" : n}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => setStockInput("")}
                style={[styles.catChip, {
                  backgroundColor: stockInput === "" ? colors.gold : colors.secondary,
                  borderColor: stockInput === "" ? colors.gold : colors.border,
                  paddingHorizontal: 14,
                }]}
              >
                <Text style={[styles.catChipText, { color: stockInput === "" ? "#1A1008" : colors.foreground, fontFamily: F.bold }]}>∞</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.modalBtns, { marginTop: 16 }]}>
              <TouchableOpacity
                onPress={() => setStockItem(null)}
                style={[styles.modalBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground, fontFamily: F.bold }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSetStock}
                disabled={loading?.startsWith("stock-")}
                style={[styles.modalBtn, { backgroundColor: "#7B1FA2", flex: 1.5 }]}
              >
                {loading?.startsWith("stock-") ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "#fff", fontFamily: F.bold }]}>حفظ الكمية</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add / Edit Occasion Modal */}
      <Modal
        visible={showAddOccasionModal || editOccasion !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowAddOccasionModal(false); setEditOccasion(null); }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: F.extra }]}>
              {editOccasion ? "تعديل المناسبة" : "إضافة مناسبة جديدة"}
            </Text>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>اسم المناسبة</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, fontFamily: F.regular, textAlign: "right" }]}
              value={occName}
              onChangeText={setOccName}
              placeholder="مثال: عروض رمضان الكريم"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>الوصف (اختياري)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, fontFamily: F.regular, textAlign: "right" }]}
              value={occDesc}
              onChangeText={setOccDesc}
              placeholder="مثال: أسعار مميزة طوال الشهر الكريم"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>صورة المناسبة (اختياري)</Text>

            {occImageUrl ? (
              <View style={{ alignItems: "center", marginBottom: 10 }}>
                <Image
                  source={{ uri: occImageUrl }}
                  style={{ width: "100%", height: 160, borderRadius: 12, backgroundColor: colors.secondary }}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => setOccImageUrl("")}
                  style={{ marginTop: 6 }}
                >
                  <Text style={{ color: "#ef4444", fontFamily: F.semi, fontSize: 13 }}>✕ إزالة الصورة</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handlePickImage}
                disabled={occImageUploading}
                style={[styles.input, {
                  backgroundColor: colors.background,
                  borderColor: colors.gold,
                  borderStyle: "dashed",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                  paddingVertical: 18,
                }]}
              >
                {occImageUploading ? (
                  <ActivityIndicator color={colors.gold} />
                ) : (
                  <>
                    <Feather name="image" size={20} color={colors.gold} />
                    <Text style={{ color: colors.gold, fontFamily: F.bold, fontSize: 14 }}>اختر صورة من الاستيديو</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => { setShowAddOccasionModal(false); setEditOccasion(null); }}
                style={[styles.modalBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground, fontFamily: F.bold }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveOccasion}
                disabled={loading === "occ-save"}
                style={[styles.modalBtn, { backgroundColor: colors.gold, flex: 1.5 }]}
              >
                {loading === "occ-save" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "#fff", fontFamily: F.bold }]}>
                    {editOccasion ? "حفظ التعديلات" : "إضافة المناسبة"}
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
  tabRow: { flex: 1, flexDirection: "row", gap: 6, paddingHorizontal: 4 },
  tabBtn: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 16, alignItems: "center" },
  tabBtnText: { fontSize: 14 },
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
  stockBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, alignSelf: "flex-start" },
  stockText: { fontSize: 11 },
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
