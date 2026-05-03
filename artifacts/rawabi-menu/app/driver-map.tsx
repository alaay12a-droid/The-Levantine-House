import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiGet } from "@/constants/api";
import { useLanguage } from "@/context/LanguageContext";

const F = {
  regular: "Cairo_400Regular",
  semi:    "Cairo_600SemiBold",
  bold:    "Cairo_700Bold",
  extra:   "Cairo_800ExtraBold",
};

const POLL_MS = 10_000;

interface AssignmentRow {
  driver: { id: number; name: string; phone: string; photoUrl?: string | null };
  assignment: {
    orderId: number;
    status: "assigned" | "picked_up" | "delivered";
    driverLat?: number | null;
    driverLng?: number | null;
  };
}

function buildHtml(lat: number, lng: number, driverName: string, isEn: boolean): string {
  const escapedName = driverName.replace(/'/g, "\\'");
  const restaurantLabel = isEn ? "Rawabi Al-Mandi" : "روابي المندي";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100vh; background: #0D1117; font-family: sans-serif; }
    #map { width: 100%; height: 100vh; }
    .leaflet-tile { filter: brightness(0.85) saturate(0.9); }
    .driver-popup { font-size: 13px; font-weight: bold; color: #032B3D; }
    .pulse-ring {
      width: 46px; height: 46px; border-radius: 50%;
      background: rgba(41,182,246,0.25);
      border: 2px solid #29B6F6;
      display: flex; align-items: center; justify-content: center;
      animation: pulse 1.6s ease-in-out infinite;
    }
    @keyframes pulse {
      0%   { box-shadow: 0 0 0 0 rgba(41,182,246,0.5); }
      70%  { box-shadow: 0 0 0 14px rgba(41,182,246,0); }
      100% { box-shadow: 0 0 0 0 rgba(41,182,246,0); }
    }
    .scooter { font-size: 26px; line-height: 1; text-align: center; }
    .restaurant-dot {
      width: 36px; height: 36px; border-radius: 50%;
      background: #E8920C;
      border: 2px solid #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
    }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true, attributionControl: false });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  var driverIcon = L.divIcon({
    html: '<div class="pulse-ring"><div class="scooter">🛵</div></div>',
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    className: ''
  });

  var restaurantIcon = L.divIcon({
    html: '<div class="restaurant-dot">🍽️</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    className: ''
  });

  var driverLatLng = L.latLng(${lat}, ${lng});
  var driverMarker = L.marker(driverLatLng, { icon: driverIcon })
    .addTo(map)
    .bindPopup('<div class="driver-popup">${escapedName}</div>');

  map.setView(driverLatLng, 15);

  var currentLat = ${lat};
  var currentLng = ${lng};
  var animFrame = null;

  function animateTo(targetLat, targetLng, steps) {
    steps = steps || 30;
    var stepLat = (targetLat - currentLat) / steps;
    var stepLng = (targetLng - currentLng) / steps;
    var count = 0;
    function step() {
      if (count >= steps) {
        currentLat = targetLat;
        currentLng = targetLng;
        return;
      }
      currentLat += stepLat;
      currentLng += stepLng;
      driverMarker.setLatLng([currentLat, currentLng]);
      count++;
      animFrame = requestAnimationFrame(step);
    }
    if (animFrame) cancelAnimationFrame(animFrame);
    step();
  }

  function handleMessage(data) {
    try {
      var msg = typeof data === 'string' ? JSON.parse(data) : data;
      if (msg.type === 'update' && msg.lat && msg.lng) {
        animateTo(msg.lat, msg.lng, 40);
        if (!map.getBounds().contains(L.latLng(msg.lat, msg.lng))) {
          map.panTo([msg.lat, msg.lng], { animate: true, duration: 1 });
        }
      }
    } catch(e) {}
  }

  document.addEventListener('message', function(e) { handleMessage(e.data); });
  window.addEventListener('message', function(e) { handleMessage(e.data); });
</script>
</body>
</html>`;
}

export default function DriverMapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orderId, driverName: paramName } = useLocalSearchParams<{ orderId: string; driverName: string }>();
  const { language } = useLanguage();
  const isEn = language === "en";

  const [assignment, setAssignment] = useState<AssignmentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [noLocation, setNoLocation] = useState(false);
  const [initialHtml, setInitialHtml] = useState<string | null>(null);
  const webViewRef = useRef<React.ComponentRef<typeof WebView>>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasHtml   = useRef(false);

  const fetchLocation = useCallback(async (isFirst: boolean) => {
    if (!orderId) return;
    try {
      const row = await apiGet<AssignmentRow | null>(`/orders/${orderId}/assignment`);
      if (!row) { if (isFirst) { setNoLocation(true); setLoading(false); } return; }
      setAssignment(row);
      const { driverLat, driverLng } = row.assignment;
      if (!driverLat || !driverLng) {
        if (isFirst) { setNoLocation(true); setLoading(false); }
        return;
      }
      if (!hasHtml.current) {
        hasHtml.current = true;
        setInitialHtml(buildHtml(driverLat, driverLng, row.driver.name, isEn));
        setLoading(false);
        setNoLocation(false);
      } else {
        webViewRef.current?.postMessage(JSON.stringify({ type: "update", lat: driverLat, lng: driverLng }));
      }
    } catch {
      if (isFirst) setLoading(false);
    }
  }, [orderId, isEn]);

  useEffect(() => {
    fetchLocation(true);
    pollRef.current = setInterval(() => fetchLocation(false), POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchLocation]);

  const topInset = Platform.OS === "web" ? 80 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        paddingTop: topInset + 8,
        paddingBottom: 12,
        paddingHorizontal: 16,
        flexDirection: "row-reverse",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 18, textAlign: "right" }}>
          {isEn ? "Live Driver Tracking" : "تتبع المندوب مباشر"}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: 8, backgroundColor: colors.secondary, borderRadius: 10 }}
        >
          <Feather name="x" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Driver badge */}
      {assignment && (
        <View style={{
          flexDirection: "row-reverse",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: "#0D2030",
          borderBottomWidth: 1,
          borderBottomColor: "#29B6F633",
        }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#29B6F622", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#29B6F655" }}>
            <Text style={{ fontSize: 20 }}>🛵</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: "#29B6F6", fontFamily: F.bold, fontSize: 14, textAlign: "right" }}>
              {assignment.driver.name}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 11, textAlign: "right" }}>
              {isEn ? "Live location · updates every 10s" : "موقع مباشر · يُحدَّث كل 10 ثوانٍ"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4CAF50" }} />
            <Text style={{ color: "#4CAF50", fontFamily: F.semi, fontSize: 11 }}>
              {isEn ? "LIVE" : "مباشر"}
            </Text>
          </View>
        </View>
      )}

      {/* Map / states */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
          <ActivityIndicator size="large" color="#29B6F6" />
          <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 14, textAlign: "center" }}>
            {isEn ? "Locating driver..." : "جاري تحديد موقع المندوب..."}
          </Text>
        </View>
      ) : noLocation ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 36 }}>
          <Text style={{ fontSize: 52 }}>📍</Text>
          <Text style={{ color: colors.foreground, fontFamily: F.bold, fontSize: 18, textAlign: "center" }}>
            {isEn ? "Location not available yet" : "الموقع غير متوفر بعد"}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 14, textAlign: "center", lineHeight: 22 }}>
            {isEn
              ? "The driver hasn't shared their location yet.\nPlease wait a moment."
              : "المندوب لم يشارك موقعه بعد.\nانتظر لحظة وستظهر خريطته تلقائياً."}
          </Text>
          <TouchableOpacity
            onPress={() => { hasHtml.current = false; setLoading(true); setNoLocation(false); fetchLocation(true); }}
            style={{ marginTop: 8, backgroundColor: "#29B6F6", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 }}
          >
            <Text style={{ color: "#032B3D", fontFamily: F.bold, fontSize: 14 }}>
              {isEn ? "Retry" : "إعادة المحاولة"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : initialHtml ? (
        <WebView
          ref={webViewRef}
          source={{ html: initialHtml }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={["*"]}
          onMessage={() => {}}
          allowsInlineMediaPlayback
        />
      ) : null}
    </View>
  );
}
