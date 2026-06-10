import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, Ticket, Loader2, Copy, Check } from "lucide-react";
import {
  useAppContext,
  GifticonCatalogItem,
  GifticonOrder,
  GifticonOrderDetail,
  GifticonStatus,
} from "@/context/AppContext";
import { BottomNav } from "@/components/BottomNav";
import { toast } from "@/hooks/use-toast";

const STATUS_META: Record<GifticonStatus, { label: string; cls: string }> = {
  requested: { label: "발급 대기중", cls: "bg-amber-100 text-amber-700" },
  fulfilled: { label: "발급 완료", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "거절됨", cls: "bg-red-100 text-red-600" },
  canceled: { label: "취소됨", cls: "bg-gray-100 text-gray-500" },
};

type Tab = "shop" | "mine";

export default function ShopPage() {
  const [_, setLocation] = useLocation();
  const {
    currentChild,
    gifticonCatalog,
    gifticonOrders,
    buyGifticon,
    cancelGifticonOrder,
    getGifticonOrderDetail,
  } = useAppContext();

  const [tab, setTab] = useState<Tab>("shop");
  const [selected, setSelected] = useState<GifticonCatalogItem | null>(null);
  const [buying, setBuying] = useState(false);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [detail, setDetail] = useState<GifticonOrderDetail | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);

  React.useEffect(() => {
    if (!currentChild) setLocation("/login");
  }, [currentChild, setLocation]);

  if (!currentChild) return null;

  const balance = currentChild.balance;
  const pendingCount = gifticonOrders.filter((o) => o.status === "requested").length;

  const confirmBuy = async () => {
    if (!selected) return;
    setBuying(true);
    try {
      await buyGifticon(selected.id);
      toast({ title: "구매 완료! 운영자가 곧 발급해드려요 🎁" });
      setSelected(null);
      setTab("mine");
    } catch (err) {
      const message = err instanceof Error ? err.message : "구매에 실패했어요.";
      toast({ title: message, variant: "destructive" });
    } finally {
      setBuying(false);
    }
  };

  const handleCancel = async (orderId: number) => {
    setCancelingId(orderId);
    try {
      await cancelGifticonOrder(orderId);
      toast({ title: "구매를 취소하고 환불했어요." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "취소에 실패했어요.";
      toast({ title: message, variant: "destructive" });
    } finally {
      setCancelingId(null);
    }
  };

  const openDetail = async (orderId: number) => {
    setDetailLoadingId(orderId);
    try {
      const d = await getGifticonOrderDetail(orderId);
      setDetail(d);
    } catch (err) {
      const message = err instanceof Error ? err.message : "기프티콘을 불러오지 못했어요.";
      toast({ title: message, variant: "destructive" });
    } finally {
      setDetailLoadingId(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-28">
      {/* Header + balance */}
      <div className="bg-white px-6 pt-12 pb-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
        <h1 className="text-lg font-bold text-gray-900 text-center mb-5">기프티콘 상점</h1>
        <div className="bg-gradient-to-br from-primary via-primary/90 to-accent/80 rounded-[22px] p-5 text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-28 h-28 bg-white/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <p className="text-white/70 font-medium text-sm mb-1">내 잔액</p>
            <h2 className="text-3xl font-black">₩{balance.toLocaleString("ko-KR")}</h2>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-5 pb-1">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("shop")}
            className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${
              tab === "shop" ? "bg-gray-900 text-white shadow-sm" : "bg-white text-gray-500 border border-gray-200"
            }`}
            data-testid="tab-shop"
          >
            상품 구경
          </button>
          <button
            onClick={() => setTab("mine")}
            className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all relative ${
              tab === "mine" ? "bg-gray-900 text-white shadow-sm" : "bg-white text-gray-500 border border-gray-200"
            }`}
            data-testid="tab-mine"
          >
            내 기프티콘
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-amber-400 text-white text-[11px] font-black rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {tab === "shop" ? (
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 gap-3">
            {gifticonCatalog.map((item, i) => {
              const affordable = balance >= item.price;
              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelected(item)}
                  className="bg-white rounded-[20px] p-4 shadow-sm border border-gray-100 text-left flex flex-col gap-2 active:bg-gray-50"
                  data-testid={`catalog-${item.id}`}
                >
                  <div className="w-14 h-14 rounded-[16px] bg-gray-50 flex items-center justify-center text-3xl mb-1">
                    {item.emoji}
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 font-bold">{item.brand}</p>
                    <p className="text-sm font-bold text-gray-900 leading-tight">{item.productName}</p>
                  </div>
                  <div className="mt-auto pt-1">
                    <p className="text-base font-black text-gray-900">
                      {item.price.toLocaleString("ko-KR")}원
                    </p>
                    {!affordable && (
                      <p className="text-[11px] text-red-400 font-bold mt-0.5">잔액이 부족해요</p>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
          {gifticonCatalog.length === 0 && (
            <div className="bg-white rounded-[24px] p-10 text-center shadow-sm border border-gray-100 mt-2">
              <p className="text-4xl mb-3">🛒</p>
              <p className="text-gray-500 font-medium">상품을 불러오는 중이에요</p>
            </div>
          )}
        </div>
      ) : (
        <div className="px-6 pt-4 space-y-3">
          {gifticonOrders.length === 0 ? (
            <div className="bg-white rounded-[24px] p-10 text-center shadow-sm border border-gray-100">
              <p className="text-4xl mb-3">🎁</p>
              <p className="text-gray-500 font-medium">아직 구매한 기프티콘이 없어요</p>
              <button
                onClick={() => setTab("shop")}
                className="mt-4 text-primary-foreground font-bold text-sm"
                data-testid="btn-go-shop"
              >
                상품 구경하러 가기 →
              </button>
            </div>
          ) : (
            gifticonOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                canceling={cancelingId === order.id}
                detailLoading={detailLoadingId === order.id}
                onCancel={() => handleCancel(order.id)}
                onOpenDetail={() => openDetail(order.id)}
              />
            ))
          )}
        </div>
      )}

      <BottomNav />

      {/* Purchase confirm sheet */}
      <AnimatePresence>
        {selected && (
          <BuyConfirmSheet
            item={selected}
            balance={balance}
            busy={buying}
            onClose={() => !buying && setSelected(null)}
            onConfirm={confirmBuy}
          />
        )}
      </AnimatePresence>

      {/* Issued gifticon detail sheet */}
      <AnimatePresence>
        {detail && <DetailSheet detail={detail} onClose={() => setDetail(null)} />}
      </AnimatePresence>
    </div>
  );
}

function OrderCard({
  order,
  canceling,
  detailLoading,
  onCancel,
  onOpenDetail,
}: {
  order: GifticonOrder;
  canceling: boolean;
  detailLoading: boolean;
  onCancel: () => void;
  onOpenDetail: () => void;
}) {
  const meta = STATUS_META[order.status];
  return (
    <div className="bg-white rounded-[20px] p-4 shadow-sm border border-gray-100" data-testid={`order-${order.id}`}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-[14px] bg-gray-50 flex items-center justify-center text-2xl flex-shrink-0">
          {order.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-400 font-bold">{order.brand}</p>
          <p className="text-sm font-bold text-gray-900 truncate">{order.productName}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.cls}`}>
            {meta.label}
          </span>
          <p className="text-sm font-black text-gray-900 mt-1">{order.price.toLocaleString("ko-KR")}원</p>
        </div>
      </div>

      {order.status === "rejected" && order.rejectReason && (
        <p className="mt-3 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
          사유: {order.rejectReason}
        </p>
      )}

      {order.status === "requested" && (
        <button
          onClick={onCancel}
          disabled={canceling}
          className="mt-3 w-full h-10 rounded-[14px] bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center gap-1.5 active:bg-gray-200 disabled:opacity-60"
          data-testid={`btn-cancel-${order.id}`}
        >
          {canceling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          구매 취소하고 환불받기
        </button>
      )}

      {order.status === "fulfilled" && (
        <button
          onClick={onOpenDetail}
          disabled={detailLoading}
          className="mt-3 w-full h-10 rounded-[14px] bg-gradient-to-r from-primary to-accent text-white font-bold text-sm flex items-center justify-center gap-1.5 active:opacity-90 disabled:opacity-60"
          data-testid={`btn-view-${order.id}`}
        >
          {detailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
          기프티콘 사용하기
        </button>
      )}
    </div>
  );
}

function BuyConfirmSheet({
  item,
  balance,
  busy,
  onClose,
  onConfirm,
}: {
  item: GifticonCatalogItem;
  balance: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const affordable = balance >= item.price;
  const after = balance - item.price;
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-[60]"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[28px] z-[61] p-6 pb-8"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">기프티콘 구매</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 bg-gray-50 rounded-full" data-testid="btn-close-buy">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center py-2">
          <div className="w-20 h-20 rounded-[22px] bg-gray-50 flex items-center justify-center text-4xl mb-3">
            {item.emoji}
          </div>
          <p className="text-sm text-gray-400 font-bold">{item.brand}</p>
          <p className="text-lg font-bold text-gray-900">{item.productName}</p>
          <p className="text-2xl font-black text-gray-900 mt-2">{item.price.toLocaleString("ko-KR")}원</p>
        </div>

        <div className="bg-gray-50 rounded-[16px] p-4 mt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">지금 잔액</span>
            <span className="font-bold text-gray-900">{balance.toLocaleString("ko-KR")}원</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">구매 후 잔액</span>
            <span className={`font-bold ${affordable ? "text-gray-900" : "text-red-500"}`}>
              {after.toLocaleString("ko-KR")}원
            </span>
          </div>
        </div>

        {affordable ? (
          <button
            onClick={onConfirm}
            disabled={busy}
            className="mt-5 w-full h-[52px] bg-gradient-to-r from-primary to-accent text-white rounded-[16px] font-bold text-base flex items-center justify-center gap-2 shadow-md disabled:opacity-60"
            data-testid="btn-confirm-buy"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {item.price.toLocaleString("ko-KR")}원에 구매하기
          </button>
        ) : (
          <div className="mt-5 w-full h-[52px] bg-gray-100 text-gray-400 rounded-[16px] font-bold text-base flex items-center justify-center">
            잔액이 부족해요
          </div>
        )}
        <p className="text-center text-xs text-gray-400 mt-3 leading-relaxed">
          구매하면 잔액이 바로 차감돼요.<br />운영자가 확인 후 기프티콘을 발급해드려요.
        </p>
      </motion.div>
    </>
  );
}

function DetailSheet({ detail, onClose }: { detail: GifticonOrderDetail; onClose: () => void }) {
  const [copied, setCopied] = useState<"pin" | "barcode" | null>(null);

  const copy = async (text: string, which: "pin" | "barcode") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast({ title: "복사하지 못했어요.", variant: "destructive" });
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-[60]"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[28px] z-[61] p-6 pb-8 max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">내 기프티콘 🎁</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 bg-gray-50 rounded-full" data-testid="btn-close-detail">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center mb-4">
          <div className="w-16 h-16 rounded-[18px] bg-gray-50 flex items-center justify-center text-3xl mb-2">
            {detail.emoji}
          </div>
          <p className="text-sm text-gray-400 font-bold">{detail.brand}</p>
          <p className="text-lg font-bold text-gray-900">{detail.productName}</p>
        </div>

        {detail.issuedImageUrl && (
          <img
            src={detail.issuedImageUrl}
            alt="기프티콘 이미지"
            className="w-full rounded-[18px] border border-gray-100 mb-4"
            data-testid="detail-image"
          />
        )}

        {detail.issuedBarcode && (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-[18px] p-4 mb-3 text-center">
            <p className="text-[11px] text-gray-400 font-bold mb-1">바코드 번호</p>
            <p className="text-xl font-black tracking-wider text-gray-900 break-all" data-testid="detail-barcode">
              {detail.issuedBarcode}
            </p>
            <button
              onClick={() => copy(detail.issuedBarcode!, "barcode")}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary-foreground"
            >
              {copied === "barcode" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === "barcode" ? "복사됨" : "복사하기"}
            </button>
          </div>
        )}

        {detail.issuedPin && (
          <div className="bg-primary/5 rounded-[18px] p-4 mb-3 text-center">
            <p className="text-[11px] text-gray-400 font-bold mb-1">핀번호</p>
            <p className="text-2xl font-black tracking-widest text-gray-900 break-all" data-testid="detail-pin">
              {detail.issuedPin}
            </p>
            <button
              onClick={() => copy(detail.issuedPin!, "pin")}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary-foreground"
            >
              {copied === "pin" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === "pin" ? "복사됨" : "복사하기"}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-2">
          가게에서 이 기프티콘을 보여주거나 번호를 입력하면 사용할 수 있어요.
        </p>
      </motion.div>
    </>
  );
}
