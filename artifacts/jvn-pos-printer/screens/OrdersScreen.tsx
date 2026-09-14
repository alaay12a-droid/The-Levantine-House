import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { markOrderPrinted } from '@/services/supabase/orders';
import { printOrderReceipt } from '@/services/sunmiPrinter';
import type { RemoteOrder } from '@/types/remoteOrder';

function money(value: number): string {
  return `${value.toFixed(2)} ر.س`;
}

function orderTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-SA', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function OrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    orders,
    connectionState,
    error,
    latestOrderName,
    removeOrder,
  } = useRealtimeOrders();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [printedLocally, setPrintedLocally] = useState<Set<string>>(
    () => new Set(),
  );

  const completeStatusUpdate = async (order: RemoteOrder) => {
    setActiveOrderId(order.id);
    try {
      await markOrderPrinted(order.id);
      removeOrder(order.id);
      setPrintedLocally((current) => {
        const next = new Set(current);
        next.delete(order.id);
        return next;
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'تعذر تحديث حالة الطلب.';
      Alert.alert('راجع حالة الطلب', message);
    } finally {
      setActiveOrderId(null);
    }
  };

  const handlePrint = async (order: RemoteOrder) => {
    setActiveOrderId(order.id);
    try {
      await printOrderReceipt({
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
        items: order.items,
        total: order.total,
        printedAt: new Date(),
      });

      setPrintedLocally((current) => new Set(current).add(order.id));
      await markOrderPrinted(order.id);
      removeOrder(order.id);
      setPrintedLocally((current) => {
        const next = new Set(current);
        next.delete(order.id);
        return next;
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('تمت الطباعة', 'طُبعت الفاتورة وتحدثت حالة الطلب إلى printed.');
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'تعذرت طباعة الطلب.';
      const wasPrinted = message.startsWith('تمت الطباعة');
      if (!wasPrinted) {
        setPrintedLocally((current) => {
          const next = new Set(current);
          next.delete(order.id);
          return next;
        });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        wasPrinted ? 'تمت الطباعة فقط' : 'تعذرت الطباعة',
        message,
      );
    } finally {
      setActiveOrderId(null);
    }
  };

  const statusCopy = {
    'not-configured': {
      text: 'بانتظار إعداد Supabase',
      color: colors.mutedForeground,
    },
    connecting: { text: 'جاري الاتصال...', color: colors.primary },
    connected: { text: 'متصل لحظيًا', color: colors.success },
    error: { text: 'الاتصال متوقف', color: colors.destructive },
  }[connectionState];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {latestOrderName ? (
        <View
          style={[
            styles.incomingBanner,
            {
              top: insets.top + 8,
              backgroundColor: colors.foreground,
            },
          ]}
        >
          <View style={[styles.bell, { backgroundColor: colors.primary }]}>
            <Feather name="bell" size={20} color={colors.primaryForeground} />
          </View>
          <View style={styles.bannerCopy}>
            <Text style={[styles.bannerTitle, { color: colors.card }]}>
              وصل طلب جديد
            </Text>
            <Text style={[styles.bannerText, { color: colors.totalMuted }]}>
              طلب {latestOrderName} جاهز للمراجعة والطباعة
            </Text>
          </View>
        </View>
      ) : null}

      <FlatList
        data={orders}
        keyExtractor={(order) => order.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (Platform.OS === 'web' ? 64 : 18),
            paddingBottom: insets.bottom + 28,
          },
          orders.length === 0 && styles.emptyContent,
        ]}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={[styles.logo, { backgroundColor: colors.primary }]}>
                <Feather
                  name="printer"
                  size={26}
                  color={colors.primaryForeground}
                />
              </View>
              <View style={styles.headerCopy}>
                <Text style={[styles.brand, { color: colors.foreground }]}>
                  جڤن
                </Text>
                <Text style={[styles.screenTitle, { color: colors.foreground }]}>
                  الطلبات الجديدة
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.connectionCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View
                style={[styles.statusDot, { backgroundColor: statusCopy.color }]}
              />
              <View style={styles.connectionCopy}>
                <Text
                  style={[
                    styles.connectionTitle,
                    { color: colors.cardForeground },
                  ]}
                >
                  {statusCopy.text}
                </Text>
                <Text
                  style={[
                    styles.connectionText,
                    { color: error ? colors.destructive : colors.mutedForeground },
                  ]}
                >
                  {error ??
                    (connectionState === 'not-configured'
                      ? 'أضف رابط Supabase والمفتاح لبدء استقبال الطلبات.'
                      : `${orders.length} طلب بانتظار الطباعة`)}
                </Text>
              </View>
              <Feather
                name={connectionState === 'connected' ? 'wifi' : 'wifi-off'}
                size={20}
                color={statusCopy.color}
              />
            </View>

            {orders.length > 0 ? (
              <Text style={[styles.queueLabel, { color: colors.mutedForeground }]}>
                قائمة الانتظار · {orders.length}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
              {connectionState === 'connecting' ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Feather
                  name="inbox"
                  size={32}
                  color={colors.mutedForeground}
                />
              )}
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {connectionState === 'not-configured'
                ? 'أكمل إعداد الاتصال'
                : 'لا توجد طلبات جديدة'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {connectionState === 'not-configured'
                ? 'بعد إضافة بيانات Supabase ستظهر طلبات pending هنا لحظيًا.'
                : 'ستظهر الطلبات الجديدة تلقائيًا دون تحديث يدوي.'}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <OrderCard
            order={item}
            number={index + 1}
            isBusy={activeOrderId === item.id}
            isPrintedLocally={printedLocally.has(item.id)}
            onPrint={() => void handlePrint(item)}
            onRetryStatus={() => void completeStatusUpdate(item)}
          />
        )}
      />
    </View>
  );
}

type OrderCardProps = {
  order: RemoteOrder;
  number: number;
  isBusy: boolean;
  isPrintedLocally: boolean;
  onPrint: () => void;
  onRetryStatus: () => void;
};

function OrderCard({
  order,
  number,
  isBusy,
  isPrintedLocally,
  onPrint,
  onRetryStatus,
}: OrderCardProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.orderCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.orderHeader}>
        <View style={[styles.orderNumber, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.orderNumberText, { color: colors.primaryDark }]}>
            #{number}
          </Text>
        </View>
        <View style={styles.orderTitleCopy}>
          <Text style={[styles.customerName, { color: colors.foreground }]}>
            {order.customerName}
          </Text>
          <Text style={[styles.orderTime, { color: colors.mutedForeground }]}>
            {orderTime(order.createdAt)}
          </Text>
        </View>
      </View>

      <InfoLine icon="phone" text={order.customerPhone} />
      <InfoLine icon="map-pin" text={order.customerAddress} />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {order.items.map((item, index) => (
        <View key={`${order.id}-${index}`} style={styles.itemRow}>
          <Text style={[styles.itemPrice, { color: colors.foreground }]}>
            {money(item.price * item.quantity)}
          </Text>
          <Text style={[styles.itemName, { color: colors.foreground }]}>
            {item.name}
          </Text>
          <Text style={[styles.itemQty, { color: colors.mutedForeground }]}>
            × {item.quantity}
          </Text>
        </View>
      ))}

      <View style={[styles.totalRow, { backgroundColor: colors.accent }]}>
        <Text style={[styles.totalValue, { color: colors.foreground }]}>
          {money(order.total)}
        </Text>
        <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
          الإجمالي
        </Text>
      </View>

      <Pressable
        disabled={isBusy}
        onPress={isPrintedLocally ? onRetryStatus : onPrint}
        style={({ pressed }) => [
          styles.printButton,
          {
            backgroundColor: isPrintedLocally
              ? colors.foreground
              : colors.primary,
            opacity: isBusy ? 0.55 : pressed ? 0.78 : 1,
          },
        ]}
      >
        {isBusy ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Feather
            name={isPrintedLocally ? 'refresh-cw' : 'printer'}
            size={20}
            color={colors.primaryForeground}
          />
        )}
        <Text
          style={[styles.printButtonText, { color: colors.primaryForeground }]}
        >
          {isBusy
            ? 'جاري التنفيذ...'
            : isPrintedLocally
              ? 'إعادة تحديث الحالة'
              : 'طباعة الطلب'}
        </Text>
      </Pressable>
    </View>
  );
}

function InfoLine({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  text: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.infoLine}>
      <Feather name={icon} size={16} color={colors.mutedForeground} />
      <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 18,
  },
  emptyContent: { flexGrow: 1 },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 13,
    marginBottom: 15,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, alignItems: 'flex-end' },
  brand: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  screenTitle: {
    fontSize: 27,
    fontFamily: 'Inter_700Bold',
    writingDirection: 'rtl',
  },
  connectionCard: {
    minHeight: 70,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 15,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 11,
    marginBottom: 20,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  connectionCopy: { flex: 1, alignItems: 'flex-end' },
  connectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    writingDirection: 'rtl',
  },
  connectionText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  queueLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'right',
    marginBottom: 9,
    writingDirection: 'rtl',
  },
  incomingBanner: {
    position: 'absolute',
    zIndex: 10,
    left: 16,
    right: 16,
    minHeight: 70,
    borderRadius: 18,
    padding: 13,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 11,
  },
  bell: {
    width: 43,
    height: 43,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCopy: { flex: 1, alignItems: 'flex-end' },
  bannerTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    writingDirection: 'rtl',
  },
  bannerText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
    fontFamily: 'Inter_400Regular',
    writingDirection: 'rtl',
  },
  emptyState: {
    flex: 1,
    minHeight: 330,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyIcon: {
    width: 74,
    height: 74,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 6,
  },
  orderCard: {
    borderWidth: 1,
    borderRadius: 21,
    padding: 16,
    marginBottom: 13,
  },
  orderHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 13,
  },
  orderNumber: {
    minWidth: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderNumberText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  orderTitleCopy: { flex: 1, alignItems: 'flex-end', marginRight: 11 },
  customerName: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    writingDirection: 'rtl',
  },
  orderTime: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  infoLine: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'right',
    fontFamily: 'Inter_400Regular',
    writingDirection: 'rtl',
  },
  divider: { height: 1, marginVertical: 11 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
    gap: 7,
  },
  itemPrice: {
    minWidth: 76,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    textAlign: 'right',
    fontFamily: 'Inter_600SemiBold',
    writingDirection: 'rtl',
  },
  itemQty: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  totalRow: {
    borderRadius: 14,
    paddingHorizontal: 13,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    writingDirection: 'rtl',
  },
  totalValue: { fontSize: 19, fontFamily: 'Inter_700Bold' },
  printButton: {
    minHeight: 53,
    borderRadius: 15,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  printButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    writingDirection: 'rtl',
  },
});