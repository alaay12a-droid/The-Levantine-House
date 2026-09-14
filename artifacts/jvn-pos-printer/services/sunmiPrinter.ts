import { Platform } from 'react-native';
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
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes('does not support') ||
    message.includes('undefined') ||
    message.includes('null')
  ) {
    return 'لم يتم العثور على طابعة Sunmi المدمجة. ثبّت نسخة APK على جهاز Sunmi V3.';
  }

  return message;
}

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

export async function printOrderReceipt(order: PrintableOrder): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error(
      'الطباعة متاحة فقط داخل نسخة Android المثبتة على جهاز Sunmi V3.',
    );
  }

  let bufferOpened = false;

  try {
    await SunmiPrinter.prepare();
    const state = await SunmiPrinter.getPrinterState();

    if (state.value !== 1) {
      throw new Error(`الطابعة غير جاهزة: ${state.description}`);
    }

    await SunmiPrinter.enterPrinterBuffer(true);
    bufferOpened = true;

    await SunmiPrinter.setAlignment('center');
    await SunmiPrinter.setTextStyle('bold', true);
    await SunmiPrinter.setFontSize(34);
    await SunmiPrinter.printText('البيت الشامي\n');

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
      await SunmiPrinter.printColumnsText(
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
    await SunmiPrinter.exitPrinterBuffer(true);
    bufferOpened = false;
  } catch (error) {
    if (bufferOpened) {
      await SunmiPrinter.exitPrinterBuffer(false).catch(() => undefined);
    }
    throw new Error(readableError(error));
  }
}