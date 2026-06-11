import React, { useState, useEffect, useCallback } from "react";
import { Loader2, LogOut, RefreshCw, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { GifticonStatus } from "@/context/AppContext";

interface AdminOrder {
  id: number;
  childId: number;
  catalogItemId: string;
  brand: string;
  productName: string;
  faceValue: number;
  price: number;
  emoji: string;
  status: GifticonStatus;
  rejectReason: string | null;
  issuedPin: string | null;
  issuedBarcode: string | null;
  issuedImageUrl: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  childName: string;
  childAvatar: string;
}

const STATUS_META: Record<GifticonStatus, { label: string; cls: string }> = {
  requested: { label: "대기중", cls: "bg-amber-100 text-amber-700" },
  fulfilled: { label: "발급완료", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "거절됨", cls: "bg-red-100 text-red-600" },
  canceled: { label: "취소됨", cls: "bg-gray-100 text-gray-500" },
  used: { label: "사용완료", cls: "bg-blue-100 text-blue-600" },
};

type Filter = "requested" | "all";

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [filter, setFilter] = useState<Filter>("requested");

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const data = await api.get<AdminOrder[]>("/gifticons/admin/orders");
      setOrders(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "주문을 불러오지 못했어요.";
      toast({ title: message, variant: "destructive" });
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await api.get("/admin/me");
        setAuthed(true);
      } catch {
        setAuthed(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (authed) void loadOrders();
  }, [authed, loadOrders]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoggingIn(true);
    try {
      await api.post("/admin/login", { password });
      setAuthed(true);
      setPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "로그인에 실패했어요.";
      toast({ title: message, variant: "destructive" });
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    try {
      await api.post("/admin/logout", {});
    } catch {
      // ignore
    }
    setAuthed(false);
    setOrders([]);
  };

  if (authed === null) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-6">
        <form
          onSubmit={login}
          className="w-full max-w-sm bg-white rounded-[24px] p-8 shadow-sm border border-gray-100"
        >
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-[18px] bg-gray-900 flex items-center justify-center mb-3">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">운영자 로그인</h1>
            <p className="text-sm text-gray-400 mt-1">기프티콘 발급 관리</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="운영자 비밀번호"
            className="w-full h-12 px-4 rounded-[14px] border border-gray-200 focus:border-gray-900 outline-none text-base mb-3"
            data-testid="input-admin-password"
            autoFocus
          />
          <button
            type="submit"
            disabled={loggingIn || !password}
            className="w-full h-12 bg-gray-900 text-white rounded-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="btn-admin-login"
          >
            {loggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            로그인
          </button>
        </form>
      </div>
    );
  }

  const visible = orders.filter((o) => (filter === "requested" ? o.status === "requested" : true));
  const requestedCount = orders.filter((o) => o.status === "requested").length;

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-12">
      <div className="bg-white px-6 pt-12 pb-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] sticky top-0 z-30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">기프티콘 발급 관리</h1>
            <p className="text-sm text-gray-400">대기중 {requestedCount}건</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => loadOrders()}
              className="p-2.5 text-gray-500 bg-gray-50 rounded-full active:bg-gray-100"
              data-testid="btn-refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loadingOrders ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={logout}
              className="p-2.5 text-gray-500 bg-gray-50 rounded-full active:bg-gray-100"
              data-testid="btn-admin-logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {(["requested", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                filter === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
              }`}
              data-testid={`admin-filter-${f}`}
            >
              {f === "requested" ? "대기중" : "전체"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pt-5 space-y-3 max-w-2xl mx-auto">
        {visible.length === 0 ? (
          <div className="bg-white rounded-[24px] p-10 text-center shadow-sm border border-gray-100">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-gray-500 font-medium">
              {filter === "requested" ? "처리할 주문이 없어요" : "주문이 없어요"}
            </p>
          </div>
        ) : (
          visible.map((order) => (
            <AdminOrderCard key={order.id} order={order} onChanged={loadOrders} />
          ))
        )}
      </div>
    </div>
  );
}

function AdminOrderCard({ order, onChanged }: { order: AdminOrder; onChanged: () => void }) {
  const meta = STATUS_META[order.status];
  const [mode, setMode] = useState<"none" | "fulfill" | "reject">("none");
  const [pin, setPin] = useState("");
  const [barcode, setBarcode] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const fulfill = async () => {
    if (!pin.trim() && !barcode.trim() && !imageUrl.trim()) {
      toast({ title: "핀번호, 바코드, 이미지 URL 중 하나는 입력해주세요.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/gifticons/admin/orders/${order.id}/fulfill`, {
        issuedPin: pin.trim() || undefined,
        issuedBarcode: barcode.trim() || undefined,
        issuedImageUrl: imageUrl.trim() || undefined,
      });
      toast({ title: "발급 완료! 부모님께 알림을 보냈어요." });
      setMode("none");
      onChanged();
    } catch (err) {
      const message = err instanceof Error ? err.message : "발급에 실패했어요.";
      toast({ title: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    try {
      await api.patch(`/gifticons/admin/orders/${order.id}/reject`, {
        reason: reason.trim() || undefined,
      });
      toast({ title: "주문을 거절하고 환불했어요." });
      setMode("none");
      onChanged();
    } catch (err) {
      const message = err instanceof Error ? err.message : "거절에 실패했어요.";
      toast({ title: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-[20px] p-4 shadow-sm border border-gray-100" data-testid={`admin-order-${order.id}`}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-[14px] bg-gray-50 flex items-center justify-center text-2xl flex-shrink-0">
          {order.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-900 truncate">
              {order.brand} {order.productName}
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {order.childAvatar} {order.childName} · {new Date(order.createdAt).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.cls}`}>
            {meta.label}
          </span>
          <p className="text-sm font-black text-gray-900 mt-1">{order.price.toLocaleString("ko-KR")}P</p>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-gray-400">
        액면가 {order.faceValue.toLocaleString("ko-KR")}P · 판매가 {order.price.toLocaleString("ko-KR")}P
      </p>

      {order.status === "fulfilled" && (
        <div className="mt-3 bg-emerald-50 rounded-[14px] p-3 text-xs text-emerald-800 space-y-1">
          {order.issuedPin && <p>핀: <span className="font-bold">{order.issuedPin}</span></p>}
          {order.issuedBarcode && <p>바코드: <span className="font-bold">{order.issuedBarcode}</span></p>}
          {order.issuedImageUrl && (
            <p className="truncate">이미지: <span className="font-bold">{order.issuedImageUrl}</span></p>
          )}
        </div>
      )}

      {order.status === "rejected" && order.rejectReason && (
        <p className="mt-3 text-xs text-red-500 bg-red-50 rounded-[14px] px-3 py-2">사유: {order.rejectReason}</p>
      )}

      {order.status === "requested" && mode === "none" && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setMode("fulfill")}
            className="flex-1 h-10 rounded-[14px] bg-gray-900 text-white font-bold text-sm active:opacity-90"
            data-testid={`btn-open-fulfill-${order.id}`}
          >
            발급하기
          </button>
          <button
            onClick={() => setMode("reject")}
            className="flex-1 h-10 rounded-[14px] bg-gray-100 text-gray-600 font-bold text-sm active:bg-gray-200"
            data-testid={`btn-open-reject-${order.id}`}
          >
            거절/환불
          </button>
        </div>
      )}

      {order.status === "requested" && mode === "fulfill" && (
        <div className="mt-3 space-y-2">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="핀번호 (선택)"
            className="w-full h-11 px-3 rounded-[12px] border border-gray-200 focus:border-gray-900 outline-none text-sm"
            data-testid={`input-pin-${order.id}`}
          />
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="바코드 번호 (선택)"
            className="w-full h-11 px-3 rounded-[12px] border border-gray-200 focus:border-gray-900 outline-none text-sm"
            data-testid={`input-barcode-${order.id}`}
          />
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="이미지 URL (선택, https://...)"
            className="w-full h-11 px-3 rounded-[12px] border border-gray-200 focus:border-gray-900 outline-none text-sm"
            data-testid={`input-imageurl-${order.id}`}
          />
          <p className="text-[11px] text-gray-400">핀번호·바코드·이미지 URL 중 하나 이상 입력하세요.</p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={fulfill}
              disabled={busy}
              className="flex-1 h-10 rounded-[14px] bg-gray-900 text-white font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
              data-testid={`btn-fulfill-${order.id}`}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              발급 완료
            </button>
            <button
              onClick={() => setMode("none")}
              disabled={busy}
              className="px-4 h-10 rounded-[14px] bg-gray-100 text-gray-500 font-bold text-sm"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {order.status === "requested" && mode === "reject" && (
        <div className="mt-3 space-y-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="거절 사유 (선택)"
            className="w-full h-11 px-3 rounded-[12px] border border-gray-200 focus:border-gray-900 outline-none text-sm"
            data-testid={`input-reason-${order.id}`}
          />
          <p className="text-[11px] text-gray-400">거절하면 아이에게 판매가가 환불돼요.</p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={reject}
              disabled={busy}
              className="flex-1 h-10 rounded-[14px] bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
              data-testid={`btn-reject-${order.id}`}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              거절하고 환불
            </button>
            <button
              onClick={() => setMode("none")}
              disabled={busy}
              className="px-4 h-10 rounded-[14px] bg-gray-100 text-gray-500 font-bold text-sm"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
