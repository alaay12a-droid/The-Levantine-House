import React, { useRef, useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  PanResponder,
  Alert,
  LayoutChangeEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAppConfig, DEFAULT_CONFIG, AppConfig } from "@/context/AppConfigContext";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

/* ──────────────────────────────────────────────
   Custom Slider (no external dependency)
────────────────────────────────────────────── */
interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onValueChange: (v: number) => void;
}

function SliderRow({ label, value, min, max, step, unit = "", onValueChange }: SliderProps) {
  const colors = useColors();
  const trackWidth = useRef(0);
  const currentValue = useRef(value);
  const [display, setDisplay] = useState(value);

  const clamp = useCallback(
    (x: number) => Math.min(max, Math.max(min, Math.round(x / step) * step)),
    [min, max, step]
  );

  const fromPx = useCallback(
    (px: number) => clamp(min + (px / trackWidth.current) * (max - min)),
    [min, max, clamp]
  );

  const pct = ((display - min) / (max - min)) * 100;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const v = fromPx(x);
        currentValue.current = v;
        setDisplay(v);
        onValueChange(v);
      },
      onPanResponderMove: (evt) => {
        const x = Math.max(0, Math.min(evt.nativeEvent.locationX, trackWidth.current));
        const v = fromPx(x);
        if (v !== currentValue.current) {
          currentValue.current = v;
          setDisplay(v);
          onValueChange(v);
        }
      },
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  return (
    <View style={slStyles.row}>
      <View style={slStyles.labelRow}>
        <Text style={[slStyles.value, { color: colors.gold, fontFamily: F.bold }]}>
          {display}{unit}
        </Text>
        <Text style={[slStyles.label, { color: colors.foreground, fontFamily: F.semi }]}>
          {label}
        </Text>
      </View>

      <View
        style={[slStyles.track, { backgroundColor: colors.secondary }]}
        onLayout={onLayout}
        {...panResponder.panHandlers}
      >
        <View style={[slStyles.fill, { width: `${pct}%`, backgroundColor: colors.gold }]} />
        <View
          style={[
            slStyles.thumb,
            {
              left: `${pct}%`,
              backgroundColor: colors.gold,
              borderColor: colors.card,
            },
          ]}
        />
      </View>

      <View style={slStyles.minMax}>
        <Text style={[slStyles.bound, { color: colors.mutedForeground, fontFamily: F.regular }]}>{max}{unit}</Text>
        <Text style={[slStyles.bound, { color: colors.mutedForeground, fontFamily: F.regular }]}>{min}{unit}</Text>
      </View>
    </View>
  );
}

const slStyles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 10 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { fontSize: 14 },
  value: { fontSize: 14 },
  track: {
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    position: "relative",
  },
  fill: {
    height: "100%",
    borderRadius: 18,
    position: "absolute",
    left: 0,
    top: 0,
  },
  thumb: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    marginLeft: -14,
    top: 4,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  minMax: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bound: { fontSize: 11 },
});

/* ──────────────────────────────────────────────
   Section header
────────────────────────────────────────────── */
function SectionHeader({ title, icon }: { title: string; icon: string }) {
  const colors = useColors();
  return (
    <View style={[secStyles.wrap]}>
      <Text style={[secStyles.title, { color: colors.gold, fontFamily: F.extra }]}>
        {title}
      </Text>
      <Text style={secStyles.icon}>{icon}</Text>
    </View>
  );
}

const secStyles = StyleSheet.create({
  wrap: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 4 },
  title: { fontSize: 15 },
  icon: { fontSize: 18 },
});

/* ──────────────────────────────────────────────
   Section card wrapper
────────────────────────────────────────────── */
function SectionCard({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[cardStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
});

/* ──────────────────────────────────────────────
   Divider inside a card
────────────────────────────────────────────── */
function Div() {
  const colors = useColors();
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />;
}

/* ──────────────────────────────────────────────
   Preview mini-card
────────────────────────────────────────────── */
function PreviewCard({ config }: { config: AppConfig }) {
  const colors = useColors();
  return (
    <View
      style={{
        marginHorizontal: 16,
        borderRadius: config.borderRadius,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: config.cardPadding,
        gap: config.sectionGap / 2,
      }}
    >
      <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: config.captionSize, textAlign: "right" }}>
        معاينة مباشرة
      </Text>
      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: config.imageSize * 0.7,
            height: config.imageSize * 0.7,
            borderRadius: config.borderRadius - 4,
            backgroundColor: colors.secondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 24 }}>🍗</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: config.bodySize, textAlign: "right" }}>
            مندي دجاج كامل
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: config.captionSize, textAlign: "right" }}>
            وجبة للأسرة • مع الرز
          </Text>
          <Text style={{ color: colors.gold, fontFamily: F.extra, fontSize: config.priceSize }}>
            44 ر.س
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ──────────────────────────────────────────────
   Main Screen
────────────────────────────────────────────── */
export default function AppSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { config, update, reset } = useAppConfig();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const confirmReset = () => {
    Alert.alert(
      "إعادة الضبط",
      "هل تريد إعادة جميع الإعدادات إلى القيم الافتراضية؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "إعادة ضبط",
          style: "destructive",
          onPress: () => reset(),
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            paddingTop: topInset + 10,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={confirmReset}
          style={styles.headerSide}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="refresh-ccw" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: F.bold }]}>
          إعدادات التطبيق
        </Text>

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerSide}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-right" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 40, paddingTop: 16, gap: 16 }}
      >
        {/* Live Preview */}
        <PreviewCard config={config} />

        {/* ── Spacing ── */}
        <View style={{ gap: 8, marginHorizontal: 16 }}>
          <SectionHeader title="المسافات" icon="📐" />
        </View>
        <SectionCard>
          <SliderRow
            label="حشو الكرت (داخلي)"
            value={config.cardPadding}
            min={8}
            max={28}
            step={1}
            unit="px"
            onValueChange={(v) => update({ cardPadding: v })}
          />
          <Div />
          <SliderRow
            label="مسافة بين الأقسام"
            value={config.sectionGap}
            min={4}
            max={28}
            step={1}
            unit="px"
            onValueChange={(v) => update({ sectionGap: v })}
          />
          <Div />
          <SliderRow
            label="حشو الصف الرأسي"
            value={config.itemPaddingV}
            min={6}
            max={26}
            step={1}
            unit="px"
            onValueChange={(v) => update({ itemPaddingV: v })}
          />
          <Div />
          <SliderRow
            label="المسافة الأفقية"
            value={config.horizontalMargin}
            min={8}
            max={28}
            step={1}
            unit="px"
            onValueChange={(v) => update({ horizontalMargin: v })}
          />
          <Div />
          <SliderRow
            label="انحناء الزوايا"
            value={config.borderRadius}
            min={4}
            max={28}
            step={1}
            unit="px"
            onValueChange={(v) => update({ borderRadius: v })}
          />
          <Div />
          <SliderRow
            label="حجم الصورة"
            value={config.imageSize}
            min={50}
            max={140}
            step={5}
            unit="px"
            onValueChange={(v) => update({ imageSize: v })}
          />
        </SectionCard>

        {/* ── Font Sizes ── */}
        <View style={{ gap: 8, marginHorizontal: 16 }}>
          <SectionHeader title="الخطوط" icon="✍️" />
        </View>
        <SectionCard>
          <SliderRow
            label="حجم العنوان"
            value={config.titleSize}
            min={14}
            max={28}
            step={1}
            unit="pt"
            onValueChange={(v) => update({ titleSize: v })}
          />
          <Div />
          <SliderRow
            label="حجم النص الأساسي"
            value={config.bodySize}
            min={11}
            max={20}
            step={1}
            unit="pt"
            onValueChange={(v) => update({ bodySize: v })}
          />
          <Div />
          <SliderRow
            label="حجم النص الثانوي"
            value={config.captionSize}
            min={9}
            max={16}
            step={1}
            unit="pt"
            onValueChange={(v) => update({ captionSize: v })}
          />
          <Div />
          <SliderRow
            label="حجم السعر"
            value={config.priceSize}
            min={12}
            max={26}
            step={1}
            unit="pt"
            onValueChange={(v) => update({ priceSize: v })}
          />
        </SectionCard>

        {/* ── Tab Bar ── */}
        <View style={{ gap: 8, marginHorizontal: 16 }}>
          <SectionHeader title="الشريط السفلي" icon="📱" />
        </View>
        <SectionCard>
          <SliderRow
            label="ارتفاع الشريط"
            value={config.tabHeight}
            min={50}
            max={100}
            step={2}
            unit="px"
            onValueChange={(v) => update({ tabHeight: v })}
          />
          <Div />
          <SliderRow
            label="الحشو السفلي"
            value={config.tabPaddingBottom}
            min={0}
            max={28}
            step={1}
            unit="px"
            onValueChange={(v) => update({ tabPaddingBottom: v })}
          />
          <Div />
          <SliderRow
            label="حجم خط التبويب"
            value={config.tabFontSize}
            min={9}
            max={16}
            step={1}
            unit="pt"
            onValueChange={(v) => update({ tabFontSize: v })}
          />
        </SectionCard>

        {/* Reset button */}
        <TouchableOpacity
          onPress={confirmReset}
          style={[styles.resetBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.8}
        >
          <Feather name="refresh-ccw" size={18} color={colors.destructive} />
          <Text style={[styles.resetText, { color: colors.destructive, fontFamily: F.bold }]}>
            إعادة ضبط جميع الإعدادات
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    justifyContent: "space-between",
  },
  headerSide: { width: 36, alignItems: "center" },
  headerTitle: { fontSize: 18, textAlign: "center" },
  resetBtn: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  resetText: { fontSize: 15 },
});
