import { useState } from "react";
import { Bell, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function Broadcast() {
  const [title, setTitle]     = useState("");
  const [body, setBody]       = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState<"ok" | "error" | null>(null);

  async function handleSend() {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setResult(null);
    try {
      await apiPost("/notifications/broadcast", { title: title.trim(), body: body.trim() });
      setResult("ok");
      setTitle("");
      setBody("");
    } catch {
      setResult("error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold">إشعار جماعي للعملاء</h1>
          <p className="text-xs text-muted-foreground">يُرسل لجميع العملاء المسجلين</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">عنوان الإشعار</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={100}
            placeholder="مثال: عرض اليوم 🔥"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 text-right"
            dir="rtl"
          />
          <p className="text-xs text-muted-foreground text-left">{title.length}/100</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">نص الرسالة</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            maxLength={300}
            rows={4}
            placeholder="اكتب تفاصيل الإشعار هنا..."
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 text-right resize-none"
            dir="rtl"
          />
          <p className="text-xs text-muted-foreground text-left">{body.length}/300</p>
        </div>

        <Button
          onClick={handleSend}
          disabled={sending || !title.trim() || !body.trim()}
          className="w-full gap-2"
        >
          <Send className="h-4 w-4" />
          {sending ? "جارٍ الإرسال..." : "إرسال للجميع"}
        </Button>

        {result === "ok" && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm text-center font-medium">
            ✅ تم إرسال الإشعار لجميع العملاء
          </div>
        )}
        {result === "error" && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm text-center font-medium">
            ❌ فشل الإرسال، حاول مرة أخرى
          </div>
        )}
      </div>
    </div>
  );
}
