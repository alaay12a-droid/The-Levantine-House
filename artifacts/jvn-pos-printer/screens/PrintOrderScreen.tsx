import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { checkPrinter, printOrderReceipt } from '@/services/sunmiPrinter';
import type { OrderItem, PrintableOrderItem } from '@/types/order';

const createItem = (): OrderItem => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  quantity: '1',
  price: '',
});

function parsePositiveNumber(value: string): number {
  const normalized = value.replace(',', '.').trim();
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function formatTotal(value: number): string {
  return `${value.toFixed(2)} ر.س`;
}

export default function PrintOrderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [items, setItems] = useState<OrderItem[]>([createItem()]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printerMessage, setPrinterMessage] = useState(
    Platform.OS === 'android'
      ? 'جاهز للاتصال بطابعة Sunmi'
      : 'المعاينة فقط — الطباعة تعمل داخل APK على جهاز Sunmi',
  );

  const total = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum +
          parsePositiveNumber(item.quantity) * parsePositiveNumber(item.price),
        0,
      ),
    [items],
  );

  const updateItem = (
    id: string,
    field: keyof Pick<OrderItem, 'name' | 'quantity' | 'price'>,
    value: string,
  ) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  };

  const addItem = () => {
    void Haptics.selectionAsync();
    setItems((current) => [...current, createItem()]);
  };

  const removeItem = (id: string) => {
    void Haptics.selectionAsync();
    setItems((current) =>
      current.length === 1
        ? current.map((item) => ({ ...item, name: '', quantity: '1', price: '' }))
        : current.filter((item) => item.id !== id),
    );
  };

  const validate = (): PrintableOrderItem[] | null => {
    if (!customerName.trim()) {
      Alert.alert('بيانات ناقصة', 'أدخل اسم الزبون.');
      return null;
    }
    if (!customerPhone.trim()) {
      Alert.alert('بيانات ناقصة', 'أدخل رقم جوال الزبون.');
      return null;
    }
    if (!customerAddress.trim()) {
      Alert.alert('بيانات ناقصة', 'أدخل عنوان الزبون.');
      return null;
    }

    const printableItems = items.map((item) => ({
      name: item.name.trim(),
      quantity: parsePositiveNumber(item.quantity),
      price: parsePositiveNumber(item.price),
    }));

    const invalidItem = printableItems.find(
      (item) => !item.name || item.quantity <= 0 || item.price <= 0,
    );
    if (invalidItem) {
      Alert.alert(
        'راجع الأصناف',
        'يجب إدخال اسم وكمية وسعر صحيح لكل صنف.',
      );
      return null;
    }

    return printableItems;
  };

  const handleCheckPrinter = async () => {
    setPrinterMessage('جاري فحص الطابعة...');
    const result = await checkPrinter();
    setPrinterMessage(result.message);
    void Haptics.notificationAsync(
      result.ready
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
  };

  const handlePrint = async () => {
    const printableItems = validate();
    if (!printableItems) return;

    setIsPrinting(true);
    setPrinterMessage('جاري تجهيز الفاتورة...');

    try {
      await printOrderReceipt({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        items: printableItems,
        total,
        printedAt: new Date(),
      });
      setPrinterMessage('تمت طباعة الفاتورة بنجاح');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('تمت الطباعة', 'خرجت الفاتورة من طابعة Sunmi بنجاح.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'تعذرت طباعة الفاتورة.';
      setPrinterMessage(message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('تعذرت الطباعة', message);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 18),
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 28),
          },
        ]}
      >
        <View style={styles.header}>
          <View
            style={[styles.logo, { backgroundColor: colors.primary }]}
          >
            <Feather name="printer" size={26} color={colors.primaryForeground} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>
              نقطة بيع مستقلة
            </Text>
            <Text style={[styles.title, { color: colors.foreground }]}>جڤن</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              إدخال الطلب وطباعة الفاتورة
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleCheckPrinter}
          testID="check-printer-button"
          style={({ pressed }) => [
            styles.statusCard,
            {
              backgroundColor: colors.accent,
              borderColor: colors.border,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <View
            style={[styles.statusDot, { backgroundColor: colors.primary }]}
          />
          <Text style={[styles.statusText, { color: colors.accentForeground }]}>
            {printerMessage}
          </Text>
          <Feather name="refresh-cw" size={17} color={colors.primary} />
        </Pressable>

        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: colors.cardForeground }]}>
              بيانات الزبون
            </Text>
            <View style={[styles.stepBadge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.stepText, { color: colors.mutedForeground }]}>
                01
              </Text>
            </View>
          </View>

          <Field
            label="اسم الزبون"
            icon="user"
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="مثال: أحمد محمد"
            colors={colors}
            testID="customer-name-input"
          />
          <Field
            label="رقم الجوال"
            icon="phone"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            placeholder="05xxxxxxxx"
            keyboardType="phone-pad"
            colors={colors}
            testID="customer-phone-input"
          />
          <Field
            label="العنوان"
            icon="map-pin"
            value={customerAddress}
            onChangeText={setCustomerAddress}
            placeholder="الحي، الشارع، رقم المبنى"
            multiline
            colors={colors}
            testID="customer-address-input"
          />
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: colors.cardForeground }]}>
              أصناف الطلب
            </Text>
            <View style={[styles.stepBadge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.stepText, { color: colors.mutedForeground }]}>
                02
              </Text>
            </View>
          </View>

          {items.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.itemCard,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <View style={styles.itemHeader}>
                <Pressable
                  onPress={() => removeItem(item.id)}
                  hitSlop={10}
                  testID={`remove-item-${index}`}
                  style={({ pressed }) => [
                    styles.removeButton,
                    {
                      backgroundColor: colors.destructiveSoft,
                      opacity: pressed ? 0.65 : 1,
                    },
                  ]}
                >
                  <Feather
                    name="trash-2"
                    size={17}
                    color={colors.destructive}
                  />
                </Pressable>
                <Text style={[styles.itemNumber, { color: colors.primary }]}>
                  الصنف {index + 1}
                </Text>
              </View>

              <Field
                label="اسم الصنف"
                icon="shopping-bag"
                value={item.name}
                onChangeText={(value) => updateItem(item.id, 'name', value)}
                placeholder="مثال: وجبة برجر"
                colors={colors}
                testID={`item-name-${index}`}
              />
              <View style={styles.itemNumbers}>
                <View style={styles.numberField}>
                  <Field
                    label="الكمية"
                    icon="hash"
                    value={item.quantity}
                    onChangeText={(value) =>
                      updateItem(item.id, 'quantity', value)
                    }
                    keyboardType="decimal-pad"
                    colors={colors}
                    testID={`item-quantity-${index}`}
                  />
                </View>
                <View style={styles.numberField}>
                  <Field
                    label="السعر"
                    icon="tag"
                    value={item.price}
                    onChangeText={(value) => updateItem(item.id, 'price', value)}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    suffix="ر.س"
                    colors={colors}
                    testID={`item-price-${index}`}
                  />
                </View>
              </View>
            </View>
          ))}

          <Pressable
            onPress={addItem}
            testID="add-item-button"
            style={({ pressed }) => [
              styles.addButton,
              {
                borderColor: colors.primary,
                backgroundColor: colors.primarySoft,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <Feather name="plus" size={20} color={colors.primary} />
            <Text style={[styles.addButtonText, { color: colors.primary }]}>
              إضافة صنف
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.totalCard,
            { backgroundColor: colors.foreground },
          ]}
        >
          <View
            style={[styles.totalIcon, { backgroundColor: colors.primary }]}
          >
            <Feather name="file-text" size={22} color={colors.primaryForeground} />
          </View>
          <View style={styles.totalCopy}>
            <Text style={[styles.totalLabel, { color: colors.totalMuted }]}>
              إجمالي الطلب
            </Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>
              {formatTotal(total)}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handlePrint}
          disabled={isPrinting}
          testID="print-receipt-button"
          style={({ pressed }) => [
            styles.printButton,
            {
              backgroundColor: colors.primary,
              opacity: isPrinting ? 0.55 : pressed ? 0.8 : 1,
            },
          ]}
        >
          {isPrinting ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Feather name="printer" size={22} color={colors.primaryForeground} />
          )}
          <Text
            style={[styles.printButtonText, { color: colors.primaryForeground }]}
          >
            {isPrinting ? 'جاري الطباعة...' : 'طباعة الفاتورة'}
          </Text>
        </Pressable>

        <Text style={[styles.helper, { color: colors.mutedForeground }]}>
          تتم الطباعة محليًا فقط ولا تُرسل بيانات الطلب إلى أي خادم.
        </Text>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

type Palette = ReturnType<typeof useColors>;

type FieldProps = {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'decimal-pad';
  multiline?: boolean;
  suffix?: string;
  colors: Palette;
  testID: string;
};

function Field({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
  suffix,
  colors,
  testID,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.input,
            minHeight: multiline ? 84 : 52,
          },
        ]}
      >
        <Feather name={icon} size={18} color={colors.mutedForeground} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType={keyboardType}
          multiline={multiline}
          textAlign="right"
          textAlignVertical={multiline ? 'top' : 'center'}
          testID={testID}
          style={[
            styles.input,
            {
              color: colors.foreground,
              minHeight: multiline ? 62 : 48,
            },
          ]}
        />
        {suffix ? (
          <Text style={[styles.suffix, { color: colors.primary }]}>{suffix}</Text>
        ) : null}
      </View>
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
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 18,
    gap: 14,
  },
  logo: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, alignItems: 'flex-end' },
  eyebrow: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  title: {
    fontSize: 31,
    lineHeight: 37,
    fontFamily: 'Inter_700Bold',
    writingDirection: 'rtl',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  statusCard: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 15,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  statusText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: 'Inter_500Medium',
  },
  section: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeading: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 19,
    fontFamily: 'Inter_700Bold',
    writingDirection: 'rtl',
  },
  stepBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  stepText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  field: { marginBottom: 13 },
  label: {
    fontSize: 12,
    marginBottom: 7,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: 'Inter_600SemiBold',
  },
  inputShell: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 9,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    writingDirection: 'rtl',
  },
  suffix: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  itemCard: {
    borderWidth: 1,
    borderRadius: 17,
    padding: 13,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemNumber: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    writingDirection: 'rtl',
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemNumbers: { flexDirection: 'row-reverse', gap: 10 },
  numberField: { flex: 1 },
  addButton: {
    minHeight: 50,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    writingDirection: 'rtl',
  },
  totalCard: {
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalCopy: { flex: 1, alignItems: 'flex-end', marginRight: 13 },
  totalLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    writingDirection: 'rtl',
  },
  totalValue: {
    fontSize: 28,
    lineHeight: 35,
    fontFamily: 'Inter_700Bold',
    writingDirection: 'rtl',
  },
  printButton: {
    minHeight: 58,
    borderRadius: 17,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  printButtonText: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    writingDirection: 'rtl',
  },
  helper: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 11,
    paddingHorizontal: 20,
  },
});