import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Star, Truck, MessageSquare } from "lucide-react";

type DriverReview = {
  orderId: number;
  stars: number;
  comment: string | null;
  createdAt: string;
};

type DriverRankingEntry = {
  id: number;
  name: string;
  phone: string;
  photoUrl: string | null;
  active: boolean;
  completedDeliveries: number;
  totalRatings: number;
  avgStars: number | null;
  recentReviews: DriverReview[];
};

function StarRow({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= Math.round(value) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30 fill-muted-foreground/10"}
        />
      ))}
    </span>
  );
}

const MEDALS: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

export default function DriverRankings() {
  const [drivers, setDrivers] = useState<DriverRankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<DriverRankingEntry[]>("/ratings/drivers");
      setDrivers(data);
    } catch {
      setError("تعذّر تحميل بيانات التقييمات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = (id: number) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ترتيب المناديب ⭐</h1>
          <p className="text-sm text-muted-foreground mt-1">
            مرتّبون حسب متوسط تقييمات العملاء
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          تحديث
        </button>
      </div>

      {/* Stats row */}
      {!loading && !error && drivers.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-amber-50 border-amber-100 p-4">
            <p className="text-xs text-muted-foreground">إجمالي التقييمات</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {drivers.reduce((s, d) => s + Number(d.totalRatings), 0)}
            </p>
          </div>
          <div className="rounded-xl border bg-blue-50 border-blue-100 p-4">
            <p className="text-xs text-muted-foreground">إجمالي التوصيلات</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {drivers.reduce((s, d) => s + Number(d.completedDeliveries), 0)}
            </p>
          </div>
          <div className="rounded-xl border bg-emerald-50 border-emerald-100 p-4">
            <p className="text-xs text-muted-foreground">متوسط التقييم</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {(() => {
                const rated = drivers.filter(d => d.avgStars !== null);
                if (!rated.length) return "—";
                const avg = rated.reduce((s, d) => s + Number(d.avgStars!), 0) / rated.length;
                return avg.toFixed(1);
              })()}
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="text-destructive font-medium">{error}</p>
          <button onClick={load} className="mt-3 text-sm text-muted-foreground underline">
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && drivers.length === 0 && (
        <div className="rounded-xl border bg-card p-12 text-center">
          <div className="text-4xl mb-3">⭐</div>
          <p className="font-semibold text-foreground">لا يوجد مناديب نشطون</p>
          <p className="text-sm text-muted-foreground mt-1">أضف مناديب من صفحة المناديب أولاً</p>
        </div>
      )}

      {/* Driver list */}
      {!loading && !error && drivers.length > 0 && (
        <div className="space-y-4">
          {drivers.map((driver, idx) => {
            const isOpen = expanded.has(driver.id);
            const avg    = driver.avgStars !== null ? Number(driver.avgStars) : null;
            const reviews = (driver.recentReviews ?? []).slice(0, 5);
            const hasReviews = reviews.length > 0;
            const medal  = MEDALS[idx] ?? null;

            return (
              <div
                key={driver.id}
                className={`rounded-2xl border bg-card overflow-hidden transition-shadow hover:shadow-md ${
                  idx === 0 ? "border-amber-300 shadow-sm shadow-amber-100" :
                  idx === 1 ? "border-zinc-300" :
                  idx === 2 ? "border-orange-200" : ""
                }`}
              >
                {/* Main row */}
                <div className="p-5">
                  <div className="flex items-center gap-4">

                    {/* Rank */}
                    <div className="text-center flex-shrink-0 w-10">
                      {medal ? (
                        <span className="text-3xl">{medal}</span>
                      ) : (
                        <span className="text-lg font-bold text-muted-foreground">#{idx + 1}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    {driver.photoUrl ? (
                      <img
                        src={driver.photoUrl}
                        alt={driver.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-border flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0 border-2 border-border">
                        <span className="text-2xl">🛵</span>
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-foreground">{driver.name}</span>
                        {avg === null && (
                          <span className="text-xs text-muted-foreground border rounded-full px-2 py-0.5">لا تقييمات بعد</span>
                        )}
                      </div>
                      {avg !== null && (
                        <div className="flex items-center gap-2 mt-1">
                          <StarRow value={avg} />
                          <span className="font-bold text-amber-500 text-sm">{avg.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">
                            ({Number(driver.totalRatings)} تقييم)
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Truck size={11} />
                          {Number(driver.completedDeliveries)} توصيلة
                        </span>
                        {hasReviews && (
                          <span className="flex items-center gap-1">
                            <MessageSquare size={11} />
                            {reviews.length} تعليق
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expand button */}
                    {hasReviews && (
                      <button
                        onClick={() => toggle(driver.id)}
                        className="text-xs text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 flex-shrink-0 transition-colors"
                      >
                        {isOpen ? "إخفاء" : "التعليقات"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Reviews */}
                {isOpen && hasReviews && (
                  <div className="border-t bg-muted/30 divide-y">
                    {reviews.map((rev, ri) => (
                      <div key={ri} className="px-5 py-3 flex gap-3 items-start">
                        <div className="flex-shrink-0 pt-0.5">
                          <StarRow value={rev.stars} size={13} />
                        </div>
                        <div className="flex-1 min-w-0">
                          {rev.comment ? (
                            <p className="text-sm text-foreground leading-relaxed">{rev.comment}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">بدون تعليق</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                          {new Date(rev.createdAt).toLocaleDateString("ar-SA", {
                            month: "short", day: "numeric",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
