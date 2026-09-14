import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Pressable, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, interpolate } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import type { Href } from 'expo-router';
import type { ComponentProps } from 'react';

const { width: screenWidth } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(screenWidth * 0.75, 320);
type FeatherName = ComponentProps<typeof Feather>['name'];
type NavItem = {
  label: string;
  path: string;
  icon: FeatherName;
  isDanger?: boolean;
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const progress = useSharedValue(0);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    progress.value = withTiming(isOpen ? 1 : 0, {
      duration: 250,
      easing: Easing.out(Easing.quad),
    });
  }, [isOpen]);

  const animatedDrawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [DRAWER_WIDTH, 0]) }],
  }));

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    pointerEvents: progress.value > 0 ? 'auto' : 'none',
  }));

  const navItems: NavItem[] = [
    { label: 'طلبات اليوم', path: '/orders', icon: 'list' },
    { label: 'الطلبات السابقة', path: '/previous', icon: 'clock' },
    { label: 'إدارة الأصناف', path: '/menu', icon: 'grid' },
    { label: 'ساعات العمل', path: '/hours', icon: 'watch' },
    { label: 'مركز المساعدة', path: '/unsupported?title=مركز المساعدة', icon: 'help-circle' },
    { label: 'مركز الإشعارات', path: '/unsupported?title=مركز الإشعارات', icon: 'bell' },
    { label: 'البرامج التعليمية', path: '/unsupported?title=البرامج التعليمية', icon: 'book-open' },
    { label: 'الإعدادات', path: '/settings', icon: 'settings' },
    { label: 'تسجيل الخروج', path: '/unsupported?title=تسجيل الخروج', icon: 'log-out', isDanger: true },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerRight} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>البيت الشامي</Text>
          <TouchableOpacity onPress={() => setIsOpen(true)} style={styles.menuButton}>
            <Feather name="menu" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {children}
      </View>

      <Animated.View style={[styles.overlay, animatedOverlayStyle, { backgroundColor: colors.overlay }]}>
        <Pressable style={styles.overlayPressable} onPress={() => setIsOpen(false)} />
      </Animated.View>

      <Animated.View style={[styles.drawer, { width: DRAWER_WIDTH, paddingTop: insets.top, backgroundColor: colors.card, borderLeftColor: colors.border, shadowColor: colors.shadow }, animatedDrawerStyle]}>
        <View style={styles.drawerHeader}>
          <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeButton}>
            <Feather name="x" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.drawerTitle, { color: colors.foreground }]}>القائمة</Text>
        </View>
        <ScrollView contentContainerStyle={styles.drawerItems}>
          {navItems.map((item, idx) => {
            const isUnsupportedPath = item.path.startsWith('/unsupported');
            const isActive = isUnsupportedPath
              ? false
              : pathname === item.path;
              
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.drawerItem, isActive && { backgroundColor: colors.accent }]}
                onPress={() => {
                  setIsOpen(false);
                  router.push(item.path as Href);
                }}
              >
                <Text style={[styles.drawerItemLabel, { color: item.isDanger ? colors.destructive : isActive ? colors.primaryDark : colors.foreground }]}>
                  {item.label}
                </Text>
                <Feather name={item.icon} size={20} color={item.isDanger ? colors.destructive : isActive ? colors.primaryDark : colors.mutedForeground} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    zIndex: 10,
  },
  headerContent: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerRight: { width: 40 },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
  },
  overlayPressable: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    zIndex: 101,
    borderLeftWidth: 1,
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  drawerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerItems: {
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 40,
    gap: 8,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  drawerItemLabel: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
