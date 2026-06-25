import { useGetRevenue, useListOrders, getGetRevenueQueryKey, getListOrdersQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatEasternNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, ShoppingBag, TrendingUp, Clock, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { data: revenue, isLoading: isRevenueLoading } = useGetRevenue({
    query: { queryKey: getGetRevenueQueryKey() }
  });
  const ordersParams = { limit: 10 };
  const { data: orders, isLoading: isOrdersLoading } = useListOrders(
    ordersParams,
    { query: { refetchInterval: 15000, queryKey: getListOrdersQueryKey(ordersParams) } }
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">نظرة عامة</h1>
        <p className="text-muted-foreground font-medium">مؤشرات الأداء لليوم</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              المبيعات اليوم
            </CardTitle>
            <div className="rounded-full bg-primary/10 p-2">
              <Banknote className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {isRevenueLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-3xl font-bold text-foreground">
                {formatEasternNumber(formatCurrency(revenue?.totalRevenue || 0))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              عدد الطلبات
            </CardTitle>
            <div className="rounded-full bg-primary/10 p-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {isRevenueLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold text-foreground">
                {formatEasternNumber(revenue?.orderCount || 0)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              متوسط قيمة الطلب
            </CardTitle>
            <div className="rounded-full bg-primary/10 p-2">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {isRevenueLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-3xl font-bold text-foreground">
                {formatEasternNumber(formatCurrency(revenue?.averageOrderValue || 0))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm flex flex-col">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                أحدث الطلبات
              </CardTitle>
              <Link href="/orders">
                <Button variant="link" className="text-primary p-0">عرض الكل</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto max-h-[400px]">
            {isOrdersLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : orders?.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-full min-h-[200px]">
                <Package className="h-12 w-12 mb-3 text-muted-foreground/50" />
                <p>لا توجد طلبات حديثة</p>
              </div>
            ) : (
              <div className="divide-y">
                {orders?.slice(0, 10).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">#{formatEasternNumber(order.dailyNumber)}</span>
                        <span className="text-sm font-medium">{order.customerName || "عميل"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-2">
                        <span>{formatEasternNumber(formatCurrency(order.totalPrice))}</span>
                        <span>•</span>
                        <span>{order.paymentMethod === 'cash' ? 'نقدي' : 'أونلاين'}</span>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`
                        ${order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' : ''}
                        ${order.status === 'preparing' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : ''}
                        ${order.status === 'ready' ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''}
                        ${order.status === 'done' ? 'bg-gray-500/10 text-gray-600 border-gray-500/20' : ''}
                        ${order.status === 'cancelled' ? 'bg-red-500/10 text-red-600 border-red-500/20' : ''}
                      `}
                    >
                      {order.status === 'pending' ? 'قيد الانتظار' :
                       order.status === 'preparing' ? 'يُحضَّر' :
                       order.status === 'ready' ? 'جاهز' :
                       order.status === 'done' ? 'مكتمل' : 'ملغي'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm flex flex-col">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              الأصناف الأكثر مبيعاً
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {isRevenueLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : revenue?.topItems && revenue.topItems.length > 0 ? (
              <div className="divide-y">
                {revenue.topItems.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground text-sm">
                        {formatEasternNumber(index + 1)}
                      </div>
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-bold text-primary">{formatEasternNumber(item.count)} طلب</span>
                      <span className="text-xs text-muted-foreground">{formatEasternNumber(formatCurrency(item.total))}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-full min-h-[200px]">
                <p>لا توجد بيانات متاحة</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
