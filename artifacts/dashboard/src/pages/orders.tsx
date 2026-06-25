import { useState } from "react";
import { useListOrders, ListOrdersStatus, Order } from "@workspace/api-client-react";
import { formatCurrency, formatEasternNumber, formatDateTime } from "@/lib/format";
import { OrderDrawer } from "@/components/order-drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { getListOrdersQueryKey } from "@workspace/api-client-react";

export default function Orders() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListOrdersStatus | "all">("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  const listParams = {
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined
  };
  const { data: orders, isLoading, isFetching } = useListOrders(
    listParams,
    { query: { refetchInterval: 15000, queryKey: getListOrdersQueryKey(listParams) } }
  );

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
  };

  const statusMap = {
    pending: { label: 'قيد الانتظار', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
    preparing: { label: 'يُحضَّر', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    ready: { label: 'جاهز', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
    done: { label: 'مكتمل', color: 'bg-gray-500/10 text-gray-600 border-gray-500/20' },
    cancelled: { label: 'ملغي', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إدارة الطلبات</h1>
          <p className="text-muted-foreground font-medium mt-1">تتبع وإدارة طلبات العملاء</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isFetching} className={isFetching ? "opacity-50" : ""}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="ابحث برقم الجوال، الاسم، أو رقم الطلب..." 
                className="pr-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full md:w-[200px]">
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="تصفية بالحالة" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  <SelectItem value="preparing">يُحضَّر</SelectItem>
                  <SelectItem value="ready">جاهز</SelectItem>
                  <SelectItem value="done">مكتمل</SelectItem>
                  <SelectItem value="cancelled">ملغي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="mt-2 pt-4 border-t flex justify-between items-center">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              </div>
            </Card>
          ))
        ) : orders?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-card rounded-xl border border-dashed">
            <p className="text-lg font-medium">لا توجد طلبات تطابق بحثك</p>
          </div>
        ) : (
          orders?.map((order) => (
            <Card key={order.id} className="overflow-hidden hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group" onClick={() => setSelectedOrder(order)}>
              <div className="p-5 flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">#{formatEasternNumber(order.dailyNumber)}</span>
                  </div>
                  <Badge variant="outline" className={statusMap[order.status as keyof typeof statusMap].color}>
                    {statusMap[order.status as keyof typeof statusMap].label}
                  </Badge>
                </div>
                
                <div className="flex-1 space-y-2">
                  <div className="font-semibold text-lg line-clamp-1">{order.customerName || "عميل"}</div>
                  {order.customerPhone && (
                    <div className="text-muted-foreground text-sm flex items-center gap-1" dir="ltr">
                      {formatEasternNumber(order.customerPhone)}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">
                    {formatDateTime(order.createdAt)}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">الإجمالي</span>
                    <span className="font-bold text-lg text-primary">{formatEasternNumber(formatCurrency(order.totalPrice))}</span>
                  </div>
                  <Button variant="secondary" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    التفاصيل
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <OrderDrawer 
        orderId={selectedOrder?.id || null} 
        open={!!selectedOrder} 
        onOpenChange={(open) => !open && setSelectedOrder(null)} 
      />
    </div>
  );
}
