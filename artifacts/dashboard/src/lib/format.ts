export function formatCurrency(halalas: number): string {
  const sar = halalas / 100;
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2
  }).format(sar);
}

export function getOrderPriceFactor(order: { totalPrice: number; deliveryFee?: number | null; items: { price: number; quantity: number }[] }): number {
  const totalPaid = order.totalPrice / 100;
  const deliveryFee = (order.deliveryFee ?? 0) / 100;
  const rawSubtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const expected = totalPaid - deliveryFee;
  return rawSubtotal > 0 && expected > rawSubtotal * 50 ? expected / rawSubtotal : 1;
}

export function formatEasternNumber(num: number | string): string {
  return String(num).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d as any]);
}

export function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(dateStr));
}
