import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

export interface LatLng { lat: number; lng: number; }

interface Props {
  points: LatLng[];
  onChange: (points: LatLng[]) => void;
}

// Tabuk center
const TABUK: L.LatLngTuple = [28.3838, 36.5662];

export default function ZoneMapPicker({ points, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const pointsRef = useRef<LatLng[]>(points);
  const onChangeRef = useRef(onChange);

  // Keep refs fresh
  useEffect(() => { pointsRef.current = points; }, [points]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { center: TABUK, zoom: 12 });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    layerGroupRef.current = group;

    map.on("click", (e: L.LeafletMouseEvent) => {
      const next = [...pointsRef.current, { lat: e.latlng.lat, lng: e.latlng.lng }];
      onChangeRef.current(next);
    });

    mapRef.current = map;
    // fix size after dialog animation
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Redraw polygon whenever points change
  useEffect(() => {
    const group = layerGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if (points.length === 0) return;

    const latlngs: L.LatLngTuple[] = points.map(p => [p.lat, p.lng]);

    // Line / polygon
    if (points.length >= 3) {
      L.polygon(latlngs, {
        color: "#C8171A",
        fillColor: "#C8171A",
        fillOpacity: 0.15,
        weight: 2.5,
      }).addTo(group);
    } else if (points.length === 2) {
      L.polyline(latlngs, { color: "#C8171A", weight: 2.5 }).addTo(group);
    }

    // Numbered markers
    points.forEach((pt, i) => {
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:#E8920C;color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${i + 1}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      L.marker([pt.lat, pt.lng], { icon }).addTo(group);
    });

    // Fit bounds
    if (points.length >= 2) {
      mapRef.current?.fitBounds(L.latLngBounds(latlngs), { padding: [30, 30] });
    }
  }, [points]);

  return (
    <div ref={containerRef} style={{ height: 300, borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb" }} />
  );
}
