import React, { useRef, useEffect, useState } from "react";
import { View, ScrollView, Image, Text, Dimensions, StyleSheet } from "react-native";
import type { ApiBanner } from "@/hooks/useBanners";

const { width: SW } = Dimensions.get("window");
const CARD_WIDTH = SW - 32;
const CARD_HEIGHT = 160;

interface Props {
  banners: ApiBanner[];
}

export function BannerCarousel({ banners }: Props) {
  const active = banners.filter((b) => b.active);
  const scrollRef = useRef<ScrollView>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (active.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => {
        const next = (prev + 1) % active.length;
        scrollRef.current?.scrollTo({ x: next * CARD_WIDTH, animated: true });
        return next;
      });
    }, 3500);
    return () => clearInterval(timer);
  }, [active.length]);

  if (active.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
          setCurrent(idx);
        }}
        style={{ width: CARD_WIDTH }}
        contentContainerStyle={{ width: CARD_WIDTH * active.length }}
      >
        {active.map((b, i) => (
          <View key={b.bannerId} style={[styles.slide, { width: CARD_WIDTH }]}>
            <Image source={{ uri: b.imageUrl }} style={styles.img} resizeMode="cover" />
            {b.title ? (
              <View style={styles.overlay}>
                <Text style={styles.title}>{b.title}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

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
