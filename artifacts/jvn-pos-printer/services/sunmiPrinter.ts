import { NativeModules, Platform } from 'react-native';
import * as SunmiPrinter from '@mitsuharu/react-native-sunmi-printer-library';
import type { PrintableOrder } from '@/types/order';

export type PrinterReadiness =
  | { ready: true; message: string }
  | { ready: false; message: string };

const LINE = '--------------------------------';

function money(value: number): string {
  return `${value.toFixed(2)} ر.س`;
}

function printDate(date: Date): string {
  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function readableError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export type PrinterLogLevel = 'info' | 'success' | 'error';
export type PrinterLogHandler = (
  level: PrinterLogLevel,
  message: string,
) => void;

export async function checkPrinter(): Promise<PrinterReadiness> {
  if (Platform.OS !== 'android') {
    return {
      ready: false,
      message: 'الطباعة متاحة فقط داخل نسخة Android المثبتة على جهاز Sunmi.',
    };
  }

  try {
    await SunmiPrinter.prepare();
    const state = await SunmiPrinter.getPrinterState();

    if (state.value !== 1) {
      return {
        ready: false,
        message: `الطابعة غير جاهزة: ${state.description}`,
      };
    }

    return { ready: true, message: 'الطابعة جاهزة للطباعة' };
  } catch (error) {
    return { ready: false, message: readableError(error) };
  }
}

export async function printOrderReceipt(
  order: PrintableOrder,
  onLog?: PrinterLogHandler,
): Promise<void> {
  const log = (level: PrinterLogLevel, message: string) => {
    console[level === 'error' ? 'error' : 'log'](`[SunmiPrinter] ${message}`);
    onLog?.(level, message);
  };

  if (Platform.OS !== 'android') {
    throw new Error(
      'الطباعة متاحة فقط داخل نسخة Android المثبتة على جهاز Sunmi V3.',
    );
  }

  try {
    log('info', 'بدء استدعاء مكتبة Sunmi الأصلية.');
    if (!NativeModules.SunmiPrinterLibrary) {
      throw new Error(
        'NativeModules.SunmiPrinterLibrary غير موجود. يلزم تثبيت APK جديد يحتوي المكتبة الأصلية، وليس تحديث JavaScript فقط.',
      );
    }
    log('success', 'تم العثور على NativeModules.SunmiPrinterLibrary.');

    log('info', 'SunmiPrinter.prepare() — جارٍ ربط خدمة الطابعة.');
    await SunmiPrinter.prepare();
    log('success', 'SunmiPrinter.prepare() نجح.');

    log('info', 'SunmiPrinter.getPrinterState() — جارٍ فحص الحالة.');
    const state = await SunmiPrinter.getPrinterState();
    log(
      state.value === 1 ? 'success' : 'error',
      `حالة الطابعة: value=${state.value}, description=${state.description ?? 'undefined'}`,
    );

    if (state.value !== 1) {
      throw new Error(`الطابعة غير جاهزة: ${state.description}`);
    }

    await SunmiPrinter.setAlignment('center');
    await SunmiPrinter.setTextStyle('bold', true);
    await SunmiPrinter.setFontSize(34);
    log('info', 'SunmiPrinter.printText() — إرسال أول سطر فعلي للطابعة.');
    await SunmiPrinter.printText('البيت الشامي\n');
    log('success', 'أول استدعاء SunmiPrinter.printText() نجح.');

    await SunmiPrinter.setFontSize(24);
    await SunmiPrinter.setTextStyle('bold', false);
    await SunmiPrinter.printText('فاتورة طلب\n');
    if (order.orderNumber) {
      await SunmiPrinter.setTextStyle('bold', true);
      await SunmiPrinter.printText(`طلب رقم #${order.orderNumber}\n`);
      await SunmiPrinter.setTextStyle('bold', false);
    }
    await SunmiPrinter.printText(`${printDate(order.printedAt)}\n`);
    await SunmiPrinter.printText(`${LINE}\n`);

    await SunmiPrinter.setAlignment('right');
    await SunmiPrinter.setTextStyle('bold', true);
    await SunmiPrinter.printText('بيانات الزبون\n');
    await SunmiPrinter.setTextStyle('bold', false);
    await SunmiPrinter.printText(`الاسم: ${order.customerName}\n`);
    await SunmiPrinter.printText(`الجوال: ${order.customerPhone}\n`);
    await SunmiPrinter.printText(`العنوان: ${order.customerAddress}\n`);
    await SunmiPrinter.printText(`${LINE}\n`);

    await SunmiPrinter.setTextStyle('bold', true);
    await SunmiPrinter.printText('تفاصيل الطلب\n');
    await SunmiPrinter.setTextStyle('bold', false);

    for (const item of order.items) {
      await SunmiPrinter.setAlignment('right');
      await SunmiPrinter.printText(`${item.name}\n`);
      await SunmiPrinter.printColumnsString(
        [money(item.quantity * item.price), `${item.quantity} × ${money(item.price)}`],
        [13, 19],
        ['left', 'right'],
      );
    }

    if (order.deliveryFee && order.deliveryFee > 0) {
      await SunmiPrinter.setAlignment('right');
      await SunmiPrinter.printText(`رسوم التوصيل: ${money(order.deliveryFee)}\n`);
    }
    if (order.notes) {
      await SunmiPrinter.setAlignment('right');
      await SunmiPrinter.setTextStyle('bold', true);
      await SunmiPrinter.printText(`ملاحظات: ${order.notes}\n`);
      await SunmiPrinter.setTextStyle('bold', false);
    }

    await SunmiPrinter.setAlignment('center');
    await SunmiPrinter.printText(`${LINE}\n`);
    await SunmiPrinter.setAlignment('right');
    await SunmiPrinter.setTextStyle('bold', true);
    await SunmiPrinter.setFontSize(32);
    await SunmiPrinter.printText(`الإجمالي: ${money(order.total)}\n`);

    await SunmiPrinter.setAlignment('center');
    await SunmiPrinter.setFontSize(22);
    await SunmiPrinter.setTextStyle('bold', false);
    await SunmiPrinter.printText(`${LINE}\n`);
    await SunmiPrinter.printText('شكرًا لاختياركم البيت الشامي\n');
    await SunmiPrinter.lineWrap(4);
    log('success', 'اكتملت جميع أوامر الطباعة وجرى تغذية الورق.');
  } catch (error) {
    const exactError = readableError(error);
    log('error', `فشل استدعاء الطابعة: ${exactError}`);
    throw new Error(exactError);
  }
}