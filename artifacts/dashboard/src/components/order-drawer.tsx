import { useGetOrder, useUpdateOrderStatus, getListOrdersQueryKey, getGetOrderQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatEasternNumber, formatDateTime } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Phone, MapPin, CreditCard, ShoppingBag, ReceiptText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface OrderDrawerProps {
  orderId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderDrawer({ orderId, open, onOpenChange }: OrderDrawerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: order, isLoading } = useGetOrder(orderId || 0, {
    query: {
      enabled: !!orderId,
      queryKey: getGetOrderQueryKey(orderId || 0),
    }
  });

  const { mutate: updateStatus, isPending: isUpdating } = useUpdateOrderStatus();

  const handleStatusChange = (newStatus: any) => {
    if (!orderId) return;
    
    updateStatus({ id: orderId, data: { status: newStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.setQueryData([`/api/orders/${orderId}`], (old: any) => 
          old ? { ...old, status: newStatus } : old
        );
        toast({
          title: "تم التحديث",
          description: "تم تحديث حالة الطلب بنجاح",
        });
      },
      onError: () => {
        toast({
          title: "خطأ",
          description: "حدث خطأ أثناء تحديث حالة الطلب",
          variant: "destructive",
        });
      }
    });
  };

  const statusMap = {
    pending: { label: 'قيد الانتظار', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
    preparing: { label: 'يُحضَّر', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    ready: { label: 'جاهز', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
    done: { label: 'مكتمل', color: 'bg-gray-500/10 text-gray-600 border-gray-500/20' },
    cancelled: { label: 'ملغي', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg flex flex-col p-0 border-l" dir="rtl">
        {isLoading || !order ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <SheetHeader className="p-6 border-b bg-card">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-2xl flex items-center gap-3">
                  <span>طلب #{formatEasternNumber(order.dailyNumber)}</span>
                  <Badge variant="outline" className={statusMap[order.status as keyof typeof statusMap].color}>
                    {statusMap[order.status as keyof typeof statusMap].label}
                  </Badge>
                </SheetTitle>
              </div>
              <SheetDescription className="text-sm mt-2">
                {formatDateTime(order.createdAt)}
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="flex-1 p-6">
              <div className="space-y-8">
                {/* Customer Info */}
                <section className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                    <ReceiptText className="w-5 h-5 text-primary" />
                    بيانات العميل
                  </h3>
                  <div className="grid gap-3">
                    <div className="font-medium text-lg">{order.customerName || "عميل"}</div>
                    {order.customerPhone && (
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span dir="ltr">{formatEasternNumber(order.customerPhone)}</span>
                      </div>
                    )}
                    {order.customerAddress && (
                      <div className="flex items-start gap-3 text-muted-foreground">
                        <MapPin className="w-4 h-4 mt-1 shrink-0" />
                        <span>{order.customerAddress}</span>
                      </div>
                    )}
                  </div>
                </section>

                {/* Items */}
                <section className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2 border-b pb-2">
                    <ShoppingBag className="w-5 h-5 text-primary" />
                    الأصناف
                  </h3>
                  <div className="space-y-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="w-8 h-8 rounded-full flex items-center justify-center p-0">
                            {formatEasternNumber(item.quantity)}
                          </Badge>
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <span className="font-bold text-muted-foreground">
                          {formatEasternNumber(formatCurrency(item.price * item.quantity))}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-4" />
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">قيمة الطلب</span>
                      <span>{formatEasternNumber(formatCurrency(order.items.reduce((acc, item) => acc + (item.price * item.quantity), 0)))}</span>
                    </div>
                    {order.deliveryFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">رسوم التوصيل</span>
                        <span>{formatEasternNumber(formatCurrency(order.deliveryFee))}</span>
                      </div>
                    )}
                    {order.discountAmount && order.discountAmount > 0 ? (
                      <div className="flex justify-between text-green-600">
                        <span>خصم {order.discountCode ? `(${order.discountCode})` : ''}</span>
                        <span dir="ltr">-{formatEasternNumber(formatCurrency(order.discountAmount))}</span>
                      </div>
                    ) : null}
                    <Separator className="my-2" />
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>الإجمالي</span>
                      <span className="text-primary">{formatEasternNumber(formatCurrency(order.totalPrice))}</span>
                    </div>
                  </div>
                </section>

                {/* Payment & Notes */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <CreditCard className="w-5 h-5 text-primary" />
                    <span className="font-medium">
                      طريقة الدفع: <span className="font-bold">{order.paymentMethod === 'cash' ? 'نقدي' : 'أونلاين'}</span>
                    </span>
                  </div>
                  
                  {order.notes && (
                    <div className="p-4 bg-yellow-50/50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg">
                      <h4 className="font-semibold text-yellow-800 dark:text-yellow-500 mb-1">ملاحظات الطلب</h4>
                      <p className="text-sm text-yellow-900/80 dark:text-yellow-500/80">{order.notes}</p>
                    </div>
                  )}
                </section>
              </div>
            </ScrollArea>

            <div className="p-6 border-t bg-card mt-auto space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">تحديث الحالة</h4>
              <div className="grid grid-cols-2 gap-2">
                {order.status === 'pending' && (
                  <Button 
                    className="w-full" 
                    disabled={isUpdating}
                    onClick={() => handleStatusChange('preparing')}
                  >
                    قبول والبدء بالتحضير
                  </Button>
                )}
                {(order.status === 'pending' || order.status === 'preparing') && (
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700 text-white" 
                    disabled={isUpdating}
                    onClick={() => handleStatusChange('ready')}
                  >
                    تحديد كجاهز
                  </Button>
                )}
                {order.status === 'ready' && (
                  <Button 
                    className="w-full bg-gray-800 hover:bg-gray-900 text-white" 
                    disabled={isUpdating}
                    onClick={() => handleStatusChange('done')}
                  >
                    تحديد كمكتمل
                  </Button>
                )}
                {order.status !== 'cancelled' && order.status !== 'done' && (
                  <Button 
                    variant="outline" 
                    className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={isUpdating}
                    onClick={() => handleStatusChange('cancelled')}
                  >
                    إلغاء الطلب
                  </Button>
                )}
                {order.status === 'done' && (
                  <div className="col-span-2 text-center text-sm font-medium text-muted-foreground py-2">
                    الطلب مكتمل ولا يمكن تغيير حالته
                  </div>
                )}
                {order.status === 'cancelled' && (
                  <div className="col-span-2 text-center text-sm font-medium text-red-500 py-2">
                    تم إلغاء هذا الطلب
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
