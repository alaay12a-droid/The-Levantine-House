/**
 * BranchPickerModal
 * Full-screen modal shown when the customer picks "استلام".
 * Displays an interactive map when the native map module is available,
 * followed by a sorted branch list and a confirm button.
 *
 * react-native-maps is loaded lazily because Expo Go does not include its
 * native module. Importing it at module scope crashes the whole app before
 * the checkout screen can render.
 */
import React, { useMemo, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  I18nManager,
  StyleSheet,
  Dimensions,
  Platform,
  Pressable,
  StatusBar,
} from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface PickerBranch {
  id: number;
  name: string;
  address: string | null;
  mapsUrl: string | null;
  lat: number | null;
  lng: number | null;
  active: boolean;
}

interface Props {
  visible: boolean;
  branches: PickerBranch[];
  selected: PickerBranch | null;
  userLat?: number | null;
  userLng?: number | null;
  onSelect: (b: PickerBranch) => void;
  onConfirm: (b: PickerBranch) => void;
  onClose: () => void;
  colors: {
    background: string;
    card: string;
    foreground: string;
    mutedForeground: string;
    border: string;
    primary: string;
    secondary: string;
    gold: string;
  };
  fontFamily: { regular: string; semi: string; bold: string };
  isEn?: boolean;
}

// ── Haversine distance (km) ────────────────────────────────────────────────────
function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const { height: SCREEN_H } = Dimensions.get("window");
const MAP_H = Math.round(SCREEN_H * 0.38);

type NativeMapsModule = {
  default: React.ComponentType<any>;
  Marker: React.ComponentType<any>;
  PROVIDER_GOOGLE?: string;
};

function loadNativeMaps(): NativeMapsModule | null {
  const isExpoGo =
    Constants.appOwnership === "expo" ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  if (Platform.OS === "web" || isExpoGo) return null;

  try {
    // Keep this require inside the runtime guard. Expo Go can bundle the
    // dependency, but it cannot evaluate it because RNMapsAirModule is absent.
    return require("react-native-maps") as NativeMapsModule;
  } catch {
    // A native build without the map module should still provide branch
    // selection through the list below.
    return null;
  }
}

// Default map region (Saudi Arabia center) when no branch has coordinates
const SAUDI_REGION = {
  latitude: 23.8859,
  longitude: 45.0792,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

export default function BranchPickerModal({
  visible,
  branches,
  selected,
  userLat,
  userLng,
  onSelect,
  onConfirm,
  onClose,
  colors,
  fontFamily: F,
  isEn = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<any>(null);
  const nativeMaps = useMemo(loadNativeMaps, []);

  // Sort branches by distance from user (branches without coords go last)
  const sorted = useMemo(() => {
    if (!userLat || !userLng) return branches;
    return [...branches].sort((a, b) => {
      const dA = a.lat != null && a.lng != null ? distKm(userLat!, userLng!, a.lat, a.lng) : Infinity;
      const dB = b.lat != null && b.lng != null ? distKm(userLat!, userLng!, b.lat, b.lng) : Infinity;
      return dA - dB;
    });
  }, [branches, userLat, userLng]);

  // Animate map to selected branch
  useEffect(() => {
    if (!selected || selected.lat == null || selected.lng == null) return;
    mapRef.current?.animateToRegion(
      {
        latitude: selected.lat,
        longitude: selected.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      400,
    );
  }, [selected]);

  // Initial map region
  const mapRegion = useMemo(() => {
    if (selected?.lat != null && selected?.lng != null) {
      return { latitude: selected.lat, longitude: selected.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 };
    }
    const first = branches.find(b => b.lat != null && b.lng != null);
    if (first?.lat != null && first?.lng != null) {
      return { latitude: first.lat, longitude: first.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 };
    }
    return SAUDI_REGION;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasBranchCoords = branches.some(b => b.lat != null && b.lng != null);
  const showNativeMap = hasBranchCoords && nativeMaps !== null;

  const renderNativeMap = () => {
    if (!nativeMaps) return null;

    const NativeMapView = nativeMaps.default;
    const NativeMarker = nativeMaps.Marker;

    return (
      <NativeMapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={mapRegion}
        provider={Platform.OS === "android" ? nativeMaps.PROVIDER_GOOGLE : undefined}
        showsUserLocation={!!(userLat && userLng)}
        showsMyLocationButton={false}
      >
        {sorted.map(b =>
          b.lat != null && b.lng != null ? (
            <NativeMarker
              key={b.id}
              coordinate={{ latitude: b.lat, longitude: b.lng }}
              title={b.name}
              description={b.address ?? undefined}
              pinColor={selected?.id === b.id ? "#E8920C" : "#999"}
              onPress={() => onSelect(b)}
            />
          ) : null,
        )}
      </NativeMapView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar backgroundColor="transparent" translucent />
      <View style={[styles.root, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>

        {/* ── Map ─────────────────────────────────────────────────────────── */}
        {showNativeMap ? (
          <View style={[styles.mapContainer, { height: MAP_H }]}>
            {renderNativeMap()}

            {/* Close button overlay */}
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { top: insets.top + 12, backgroundColor: colors.card }]}
            >
              <Text style={{ fontSize: 16, color: colors.foreground }}>✕</Text>
            </Pressable>
          </View>
        ) : (
          /* Expo Go / no coords — show a clear list-based alternative */
          <View style={[styles.headerBar, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
            <Pressable onPress={onClose} style={styles.headerClose}>
              <Text style={{ fontSize: 18, color: colors.foreground }}>✕</Text>
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: F.bold }]}>
              {isEn ? "Choose Pickup Branch" : "اختار الفرع للاستلام"}
            </Text>
            <View style={{ width: 40 }} />
          </View>
        )}

        {/* ── Branch list ─────────────────────────────────────────────────── */}
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          {!showNativeMap && hasBranchCoords && (
            <View style={[styles.mapFallback, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <Text style={[styles.mapFallbackTitle, { color: colors.foreground, fontFamily: F.bold }]}>
                {isEn ? "Map preview is unavailable here" : "الخريطة غير متاحة في هذا الوضع"}
              </Text>
              <Text style={[styles.mapFallbackText, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                {isEn
                  ? "Choose your pickup branch from the list below."
                  : "اختر فرع الاستلام من القائمة أدناه."}
              </Text>
            </View>
          )}
          {showNativeMap && (
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sheetTitle, { color: colors.foreground, fontFamily: F.bold }]}>
                {isEn ? "Choose Pickup Branch" : "اختار الفرع للاستلام"}
              </Text>
            </View>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}
          >
            {sorted.map(b => {
              const isSelected = selected?.id === b.id;
              const km =
                userLat && userLng && b.lat != null && b.lng != null
                  ? distKm(userLat, userLng, b.lat, b.lng)
                  : null;

              return (
                <TouchableOpacity
                  key={b.id}
                  activeOpacity={0.8}
                  onPress={() => onSelect(b)}
                  style={[
                    styles.branchRow,
                    {
                      backgroundColor: isSelected ? colors.primary + "14" : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  {/* Radio */}
                  <View
                    style={[
                      styles.radio,
                      {
                        borderColor: isSelected ? colors.primary : colors.mutedForeground,
                        backgroundColor: isSelected ? colors.primary : "transparent",
                      },
                    ]}
                  >
                    {isSelected && <View style={styles.radioDot} />}
                  </View>

                  {/* Info */}
                  <View style={styles.branchInfo}>
                    {/* Name + distance row */}
                    <View style={styles.branchTopRow}>
                      <Text style={[styles.branchName, { color: colors.foreground, fontFamily: F.bold }]}>
                        {b.name}
                      </Text>
                      {km !== null && (
                        <Text style={[styles.distBadge, { color: colors.mutedForeground, fontFamily: F.semi }]}>
                          {km < 1 ? `${Math.round(km * 1000)} م` : `${km.toFixed(2)} كم`}
                        </Text>
                      )}
                    </View>

                    {/* Address */}
                    {b.address ? (
                      <Text style={[styles.branchAddr, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                        {b.address}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Confirm button ───────────────────────────────────────────────── */}
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            activeOpacity={selected ? 0.8 : 1}
            onPress={() => selected && onConfirm(selected)}
            style={[
              styles.confirmBtn,
              { backgroundColor: selected ? "#E8920C" : colors.border },
            ]}
          >
            <Text style={[styles.confirmBtnText, { fontFamily: F.bold, color: selected ? "#fff" : colors.mutedForeground }]}>
              {isEn ? "Pickup from here" : "الاستلام من هنا"}
            </Text>
            {selected && (
              <Text style={[styles.confirmBtnSub, { fontFamily: F.semi }]}>
                {selected.name}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  mapContainer: {
    width: "100%",
    overflow: "hidden",
  },
  closeBtn: {
    position: "absolute",
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerBar: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
  },
  headerClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    flex: 1,
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mapFallback: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: "flex-end",
    gap: 3,
  },
  mapFallbackTitle: {
    fontSize: 15,
  },
  mapFallbackText: {
    fontSize: 12,
    textAlign: "right",
  },
  sheetTitle: {
    fontSize: 16,
    textAlign: "right",
  },
  branchRow: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  branchInfo: {
    flex: 1,
    gap: 3,
  },
  branchTopRow: {
    flexDirection: I18nManager.isRTL ? "row" : "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  branchName: {
    fontSize: 15,
    textAlign: "right",
    flex: 1,
  },
  distBadge: {
    fontSize: 12,
    textAlign: I18nManager.isRTL ? "left" : "right",
  },
  branchAddr: {
    fontSize: 12,
    textAlign: "right",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  confirmBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    gap: 3,
  },
  confirmBtnText: {
    fontSize: 17,
  },
  confirmBtnSub: {
    fontSize: 13,
    color: "#fff",
    opacity: 0.85,
  },
});
