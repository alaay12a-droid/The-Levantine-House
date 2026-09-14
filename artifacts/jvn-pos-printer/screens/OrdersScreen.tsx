import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAutomaticOrderPrinter } from '@/hooks/useAutomaticOrderPrinter';
import type { RemoteOrder } from '@/types/remoteOrder';

const logo = require('@/assets/images/levantine-house-logo.jpg');

function money(value: number) {
  return `${value.toFixed(2)} ر.س`;
}

export default function OrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    orders,
    isConnected,
    activeOrderId,
    lastPrintedOrder,
    error,
    isPreview,
  } =
    useAutomaticOrderPrinter();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (Platform.OS === 'web' ? 58 : 16),
            paddingBottom: insets.bottom + 28,
          },
          orders.length === 0 && styles.grow,
        ]}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Image source={logo} style={styles.logo} />
              <View style={styles.headerCopy}>
                <Text style={[styles.brand, { color: colors.foreground }]}>
                  البيت الشامي
                </Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  الطباعة التلقائية للطلبات المقبولة
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.statusCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: isPreview
                      ? colors.primary
                      : isConnected
                      ? colors.success
                      : colors.destructive,
                  },
                ]}
              />
              <View style={styles.statusCopy}>
                <Text style={[styles.statusTitle, { color: colors.foreground }]}>
                  {isPreview
                    ? 'معاينة الواجهة'
                    : isConnected
                      ? 'متصل بخادم البيت الشامي'
                      : 'الاتصال متوقف'}
                </Text>
                <Text
                  style={[
                    styles.statusText,
                    {
                      color: error
                        ? colors.destructive
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  {isPreview
                    ? 'الاتصال والطباعة التلقائية يعملان داخل تطبيق Android.'
                    : error ??
                    (activeOrderId
                      ? `تتم الآن طباعة الطلب #${activeOrderId}`
                      : lastPrintedOrder
                        ? `آخر فاتورة مطبوعة #${lastPrintedOrder}`
                        : 'تتم مراقبة الطلبات كل 5 ثوانٍ')}
                </Text>
              </View>
              {activeOrderId ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Feather
                  name={isPreview ? 'monitor' : isConnected ? 'wifi' : 'wifi-off'}
                  size={20}
                  color={
                    isPreview
                      ? colors.primary
                      : isConnected
                        ? colors.success
                        : colors.destructive
                  }
                />
              )}
            </View>
            {orders.length > 0 ? (
              <Text style={[styles.queue, { color: colors.mutedForeground }]}>
                بانتظار الطباعة · {orders.length}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
              <Feather
                name="printer"
                size={32}
                color={colors.mutedForeground}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              الطابعة جاهزة
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              سيُطبع أي طلب ينتقل إلى «قيد التجهيز» تلقائيًا، بدون ضغط أي زر.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <OrderCard order={item} printing={activeOrderId === item.id} />
        )}
      />
    </View>
  );
}

function OrderCard({
  order,
  printing,
}: {
  order: RemoteOrder;
  printing: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.orderCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.orderHeader}>
        <Text style={[styles.orderNumber, { color: colors.primaryDark }]}>
          طلب #{order.dailyNumber ?? order.id}
        </Text>
        <Text style={[styles.customer, { color: colors.foreground }]}>
          {order.customerName}
        </Text>
      </View>
      <Text style={[styles.details, { color: colors.mutedForeground }]}>
        {order.customerPhone} · {order.customerAddress ?? 'استلام من الفرع'}
      </Text>
      {order.items.map((item, index) => (
        <View key={`${order.id}-${index}`} style={styles.itemRow}>
          <Text style={[styles.price, { color: colors.foreground }]}>
            {money(item.price * item.quantity)}
          </Text>
          <Text style={[styles.itemName, { color: colors.foreground }]}>
            {item.quantity} × {item.name}
          </Text>
        </View>
      ))}
      <View style={[styles.totalRow, { backgroundColor: colors.accent }]}>
        <Text style={[styles.total, { color: colors.foreground }]}>
          {money(order.total)}
        </Text>
        <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
          الإجمالي
        </Text>
      </View>
      {printing ? (
        <View style={[styles.printing, { backgroundColor: colors.foreground }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.printingText, { color: colors.card }]}>
            جاري الطباعة تلقائيًا...
          </Text>
        </View>
      ) : null}
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
  grow: { flexGrow: 1 },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 13,
    marginBottom: 15,
  },
  logo: { width: 66, height: 66, borderRadius: 20 },
  headerCopy: { flex: 1, alignItems: 'flex-end' },
  brand: {
    fontSize: 27,
    fontFamily: 'Inter_700Bold',
    writingDirection: 'rtl',
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'right',
    fontFamily: 'Inter_400Regular',
    writingDirection: 'rtl',
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 76,
    paddingHorizontal: 15,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 11,
    marginBottom: 18,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusCopy: { flex: 1, alignItems: 'flex-end' },
  statusTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    writingDirection: 'rtl',
  },
  statusText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
    fontFamily: 'Inter_400Regular',
    writingDirection: 'rtl',
  },
  queue: {
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 8,
    fontFamily: 'Inter_600SemiBold',
  },
  empty: {
    flex: 1,
    minHeight: 350,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  emptyTitle: { fontSize: 21, fontFamily: 'Inter_700Bold' },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    writingDirection: 'rtl',
    marginTop: 5,
  },
  orderCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 15,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  customer: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    writingDirection: 'rtl',
  },
  details: {
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginVertical: 9,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  price: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  itemName: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    writingDirection: 'rtl',
  },
  totalRow: {
    minHeight: 50,
    borderRadius: 13,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  total: { fontSize: 19, fontFamily: 'Inter_700Bold' },
  totalLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  printing: {
    minHeight: 48,
    borderRadius: 13,
    marginTop: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  printingText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});