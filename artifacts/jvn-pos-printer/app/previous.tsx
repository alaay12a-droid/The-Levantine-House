import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useOrdersQuery } from '@/hooks/useApi';
import { RemoteOrder } from '@/types/remoteOrder';
import { Feather } from '@expo/vector-icons';

function money(value: number) {
  return `${value.toFixed(2)} ر.س`;
}

export default function PreviousOrdersScreen() {
  const colors = useColors();
  const { data: orders = [], isLoading, isError, error, refetch } = useOrdersQuery();

  const previousOrders = orders.filter((o) => o.status === 'done' || o.status === 'cancelled');

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>الطلبات السابقة</Text>
      </View>

      <FlatList
        data={previousOrders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : isError ? (
            <View style={styles.emptyState}>
              <Feather name="alert-triangle" size={32} color={colors.destructive} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyTitle, { color: colors.destructive }]}>تعذر جلب الطلبات</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground, textAlign: 'center' }]}>{error?.message}</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
                <Text style={[styles.retryText, { color: colors.primaryForeground }]}>إعادة المحاولة</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.muted }]}>
                <Feather name="clock" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>لا توجد طلبات سابقة</Text>
            </View>
          )
        }
        renderItem={({ item }) => <OrderCard order={item} />}
      />
    </View>
  );
}

function OrderCard({ order }: { order: RemoteOrder }) {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.badge, { backgroundColor: order.status === 'cancelled' ? colors.destructiveSoft : colors.successSoft }]}>
          <Text style={[styles.badgeText, { color: order.status === 'cancelled' ? colors.destructive : colors.success }]}>
            {order.status === 'cancelled' ? 'ملغي' : 'مكتمل'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.orderNumber, { color: colors.primaryDark }]}>#{order.dailyNumber ?? order.id}</Text>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>
            {new Date(order.createdAt).toLocaleDateString('ar-SA')} · {new Date(order.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>

      <View style={styles.customerInfo}>
        <Text style={[styles.customerName, { color: colors.foreground }]}>{order.customerName}</Text>
      </View>

      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>الإجمالي: <Text style={[styles.totalAmount, { color: colors.foreground }]}>{money(order.total)}</Text></Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  headerRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  time: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  customerInfo: {
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  customerName: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  totalAmount: {
    fontFamily: 'Inter_700Bold',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
