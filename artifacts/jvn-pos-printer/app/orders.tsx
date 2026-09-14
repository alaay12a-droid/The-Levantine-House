import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl, Modal } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import {
  assignDriverWhilePreparing,
  AvailableDriver,
  fetchAvailableDrivers,
  fetchDriversAutoAssignSetting,
  useOrdersQuery,
  useUpdateOrderStatus,
} from '@/hooks/useApi';
import { usePrinter } from '@/contexts/PrinterContext';
import { RemoteOrder } from '@/types/remoteOrder';
import { PrinterDiagnostics } from '@/components/PrinterDiagnostics';

type OrderTab = 'new' | 'preparing' | 'ready' | 'refund';
type NewFilter = 'all' | 'delivery' | 'pickup';
type RefundFilter = 'all' | 'orders' | 'dispute';

function isTodayRiyadh(dateString: string) {
  const today = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const date = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(dateString));
  return today === date;
}

function money(value: number) {
  return `${value.toFixed(2)} ر.س`;
}

export default function OrdersScreen() {
  const colors = useColors();
  const { data: orders = [], isLoading, isError, error, refetch, isRefetching } = useOrdersQuery();
  const [activeTab, setActiveTab] = useState<OrderTab>('new');
  const [newFilter, setNewFilter] = useState<NewFilter>('all');
  const [refundFilter, setRefundFilter] = useState<RefundFilter>('all');
  const [driverOrder, setDriverOrder] = useState<RemoteOrder | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<AvailableDriver[]>([]);
  const [driverDialogLoading, setDriverDialogLoading] = useState(false);
  const [driverAssigningId, setDriverAssigningId] = useState<number | null>(null);
  const [driverDialogError, setDriverDialogError] = useState('');
  
  const filteredOrders = orders.filter((o) => {
    if (!isTodayRiyadh(o.createdAt)) return false;
    
    if (activeTab === 'new') {
      if (o.status !== 'pending') return false;
      if (newFilter === 'delivery' && o.orderType !== 'delivery') return false;
      if (newFilter === 'pickup' && o.orderType !== 'pickup') return false;
      return true;
    }
    if (activeTab === 'preparing') return o.status === 'preparing';
    if (activeTab === 'ready') return o.status === 'ready';
    return false; // Refund is always empty/unsupported
  });

  const TABS: { id: OrderTab; label: string }[] = [
    { id: 'new', label: 'جديد' },
    { id: 'preparing', label: 'قيد التحضير' },
    { id: 'ready', label: 'الوجبة جاهزة' },
    { id: 'refund', label: 'الاسترداد' },
  ];

  const pendingOrders = orders.filter(o => isTodayRiyadh(o.createdAt) && o.status === 'pending');
  const deliveryCount = pendingOrders.filter(o => o.orderType === 'delivery').length;
  const pickupCount = pendingOrders.filter(o => o.orderType === 'pickup').length;
  const allCount = pendingOrders.length;

  const FILTERS: { id: NewFilter; label: string }[] = [
    { id: 'all', label: `الكل (${allCount})` },
    { id: 'delivery', label: `توصيل (${deliveryCount})` },
    { id: 'pickup', label: `استلام شخصي (${pickupCount})` },
  ];

  const REFUND_FILTERS: { id: RefundFilter; label: string }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'orders', label: 'الطلبات' },
    { id: 'dispute', label: 'اعتراض' },
  ];

  const closeDriverDialog = () => {
    if (driverDialogLoading || driverAssigningId !== null) return;
    setDriverOrder(null);
    setAvailableDrivers([]);
    setDriverDialogError('');
  };

  const handleAcceptedDelivery = async (order: RemoteOrder) => {
    if (order.orderType !== 'delivery') return;

    setDriverOrder(order);
    setAvailableDrivers([]);
    setDriverDialogError('');
    setDriverDialogLoading(true);

    try {
      const autoAssign = await fetchDriversAutoAssignSetting();
      if (autoAssign) {
        await assignDriverWhilePreparing(order.id);
        setDriverOrder(null);
        return;
      }

      const drivers = await fetchAvailableDrivers();
      setAvailableDrivers(drivers);
      if (drivers.length === 0) {
        setDriverDialogError('لا يوجد مندوب متاح حاليًا.');
      }
    } catch (error) {
      setDriverDialogError(error instanceof Error ? error.message : 'تعذر تعيين المندوب.');
    } finally {
      setDriverDialogLoading(false);
    }
  };

  const handleSelectDriver = async (driver: AvailableDriver) => {
    if (!driverOrder) return;
    setDriverAssigningId(driver.id);
    setDriverDialogError('');
    try {
      await assignDriverWhilePreparing(driverOrder.id, driver.id);
      setDriverOrder(null);
      setAvailableDrivers([]);
    } catch (error) {
      setDriverDialogError(error instanceof Error ? error.message : 'تعذر تعيين المندوب.');
      try {
        setAvailableDrivers(await fetchAvailableDrivers());
      } catch {
        // Keep the assignment error visible if refreshing the list also fails.
      }
    } finally {
      setDriverAssigningId(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabLabel, { color: activeTab === tab.id ? colors.primaryDark : colors.mutedForeground }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'new' && (
        <View style={[styles.subfilters, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.subfilter, newFilter === f.id && { backgroundColor: colors.primarySoft }]}
              onPress={() => setNewFilter(f.id)}
            >
              <Text style={[styles.subfilterLabel, { color: newFilter === f.id ? colors.primaryDark : colors.foreground }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {activeTab === 'refund' && (
        <View style={[styles.subfilters, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {REFUND_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.subfilter, refundFilter === f.id && { backgroundColor: colors.primarySoft }]}
              onPress={() => setRefundFilter(f.id)}
            >
              <Text style={[styles.subfilterLabel, { color: refundFilter === f.id ? colors.primaryDark : colors.foreground }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={activeTab === 'refund' ? [] : filteredOrders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListHeaderComponent={<PrinterDiagnostics />}
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
                <Feather name="file-text" size={32} color={colors.mutedForeground} />
              </View>
              {activeTab === 'refund' ? (
                <>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>غير متاح حاليًا</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>المبالغ المستردة غير مدعومة بعد.</Text>
                </>
              ) : (
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>لا توجد طلبات حتى الآن</Text>
              )}
            </View>
          )
        }
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            tab={activeTab}
            onAcceptedDelivery={handleAcceptedDelivery}
          />
        )}
      />

      <Modal
        visible={driverOrder !== null}
        transparent
        animationType="fade"
        onRequestClose={closeDriverDialog}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.driverDialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.driverDialogHeader}>
              <TouchableOpacity
                onPress={closeDriverDialog}
                disabled={driverDialogLoading || driverAssigningId !== null}
                style={[styles.modalClose, { backgroundColor: colors.muted }]}
              >
                <Feather name="x" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <View style={styles.driverDialogTitleBlock}>
                <Text style={[styles.driverDialogTitle, { color: colors.foreground }]}>تعيين مندوب</Text>
                <Text style={[styles.driverDialogSubtitle, { color: colors.mutedForeground }]}>
                  الطلب #{driverOrder?.dailyNumber ?? driverOrder?.id}
                </Text>
              </View>
            </View>

            {driverDialogLoading ? (
              <View style={styles.driverDialogState}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.driverDialogSubtitle, { color: colors.mutedForeground }]}>جاري التحقق من الإعداد...</Text>
              </View>
            ) : (
              <>
                {driverDialogError ? (
                  <Text style={[styles.driverDialogError, { color: colors.destructive }]}>{driverDialogError}</Text>
                ) : null}
                {availableDrivers.map(driver => (
                  <TouchableOpacity
                    key={driver.id}
                    onPress={() => handleSelectDriver(driver)}
                    disabled={driverAssigningId !== null}
                    style={[styles.driverRow, { borderColor: colors.border, backgroundColor: colors.background }]}
                  >
                    {driverAssigningId === driver.id ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Feather name="chevron-left" size={20} color={colors.primary} />
                    )}
                    <View style={styles.driverRowText}>
                      <Text style={[styles.driverName, { color: colors.foreground }]}>{driver.name}</Text>
                      <Text style={[styles.driverPhone, { color: colors.mutedForeground }]}>{driver.phone}</Text>
                    </View>
                    <View style={[styles.availableBadge, { backgroundColor: colors.primarySoft }]}>
                      <Text style={[styles.availableBadgeText, { color: colors.primaryDark }]}>متاح</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function OrderCard({
  order,
  tab,
  onAcceptedDelivery,
}: {
  order: RemoteOrder;
  tab: string;
  onAcceptedDelivery: (order: RemoteOrder) => void;
}) {
  const colors = useColors();
  const updateStatus = useUpdateOrderStatus();
  const { activeOrderId, silenceOrderAlert, resumeOrderAlert } = usePrinter();

  const isPrinting = activeOrderId === order.id;

  const handleAction = () => {
    if (tab === 'new') {
      silenceOrderAlert(order.id);
      updateStatus.mutate(
        { id: order.id, status: 'preparing' },
        {
          onSuccess: () => onAcceptedDelivery(order),
          onError: () => resumeOrderAlert(order.id),
        },
      );
    }
    else if (tab === 'preparing') updateStatus.mutate({ id: order.id, status: 'ready' });
    else if (tab === 'ready') updateStatus.mutate({ id: order.id, status: 'done' });
  };

  const getActionLabel = () => {
    if (isPrinting) return 'جاري الطباعة...';
    if (updateStatus.isPending) return 'جاري التحديث...';
    if (tab === 'new') return 'قبول وتجهيز';
    if (tab === 'preparing') return 'جاهز للاستلام';
    if (tab === 'ready') return 'اكتمل';
    return '';
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.badge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.badgeText, { color: colors.foreground }]}>
            {order.orderType === 'delivery' ? 'توصيل' : 'استلام شخصي'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.orderNumber, { color: colors.primaryDark }]}>#{order.dailyNumber ?? order.id}</Text>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>
            {new Date(order.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
      
      <View style={styles.customerInfo}>
        <Text style={[styles.customerName, { color: colors.foreground }]}>{order.customerName}</Text>
        <Text style={[styles.customerDetails, { color: colors.mutedForeground }]}>
          {order.customerPhone} {order.orderType === 'delivery' ? `· ${order.customerAddress}` : ''}
        </Text>
      </View>

      <View style={[styles.itemsList, { borderColor: colors.border }]}>
        {order.items.map((item, idx) => (
          <View key={idx} style={styles.itemRow}>
            <Text style={[styles.itemPrice, { color: colors.foreground }]}>{money(item.price * item.quantity)}</Text>
            <Text style={[styles.itemName, { color: colors.foreground }]}>{item.quantity} × {item.name}</Text>
          </View>
        ))}
      </View>

      {updateStatus.isError && (
        <Text style={[styles.errorText, { color: colors.destructive }]}>
          {updateStatus.error?.message}
        </Text>
      )}

      <View style={styles.cardFooter}>
        <View style={styles.totalBlock}>
          <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>الإجمالي</Text>
          <Text style={[styles.totalAmount, { color: colors.foreground }]}>{money(order.total)}</Text>
        </View>
        {getActionLabel() ? (
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: colors.primary },
              (isPrinting || updateStatus.isPending) && { opacity: 0.7 }
            ]}
            onPress={handleAction}
            disabled={isPrinting || updateStatus.isPending}
          >
            <Text style={[styles.actionButtonText, { color: colors.primaryForeground }]}>{getActionLabel()}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  driverDialog: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '78%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  driverDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  driverDialogTitleBlock: { alignItems: 'flex-end', gap: 2 },
  driverDialogTitle: { fontSize: 20, fontWeight: '800' },
  driverDialogSubtitle: { fontSize: 13, textAlign: 'right' },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverDialogState: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 12 },
  driverDialogError: { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  driverRow: {
    minHeight: 70,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverRowText: { flex: 1, alignItems: 'flex-end' },
  driverName: { fontSize: 16, fontWeight: '800' },
  driverPhone: { fontSize: 12 },
  availableBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  availableBadgeText: { fontSize: 11, fontWeight: '800' },
  tabs: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    height: 48,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  subfilters: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  subfilter: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  subfilterLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
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
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  customerName: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  customerDetails: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  itemsList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent', // Will be overridden or set below
    paddingVertical: 12,
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    textAlign: 'right',
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'right',
    marginTop: 8,
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  totalBlock: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  totalAmount: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
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
