import React, { useRef, useEffect, useState, useCallback } from "react";
import { View, FlatList, Image, Text, Dimensions, StyleSheet } from "react-native";
import type { ApiBanner } from "@/hooks/useBanners";

const { width: SW } = Dimensions.get("window");
const CARD_WIDTH = SW - 32;
const CARD_HEIGHT = 160;

interface Props {
  banners: ApiBanner[];
}

export function BannerCarousel({ banners }: Props) {
  const active = banners.filter((b) => b.active);
  const flatRef = useRef<FlatList>(null);
  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToIndex = useCallback((index: number) => {
    try {
      flatRef.current?.scrollToIndex({ index, animated: true });
    } catch {}
    setCurrent(index);
    currentRef.current = index;
  }, []);

  useEffect(() => {
    if (active.length <= 1) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const next = (currentRef.current + 1) % active.length;
      scrollToIndex(next);
    }, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active.length, scrollToIndex]);

  if (active.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <FlatList
        ref={flatRef}
        data={active}
        keyExtractor={(b) => String(b.bannerId)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: CARD_WIDTH,
          offset: CARD_WIDTH * index,
          index,
        })}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
          setCurrent(idx);
          currentRef.current = idx;
        }}
        style={{ width: CARD_WIDTH }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: CARD_WIDTH }]}>
            <Image source={{ uri: item.imageUrl }} style={styles.img} resizeMode="cover" />
            {item.title ? (
              <View style={styles.overlay}>
                <Text style={styles.title}>{item.title}</Text>
              </View>
            ) : null}
          </View>
        )}
      />

      {active.length > 1 && (
        <View style={styles.dots}>
          {active.map((_, i) => (
            <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    alignItems: "center",
  },
  slide: {
    borderRadius: 14,
    overflow: "hidden",
    height: CARD_HEIGHT,
  },
  img: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#00000088",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  title: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#5A3A1A",
  },
  dotActive: {
    backgroundColor: "#C9863A",
    width: 18,
  },
});
