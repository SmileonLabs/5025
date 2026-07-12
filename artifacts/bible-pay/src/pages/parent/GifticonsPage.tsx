import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ChevronLeft, Plus, Trash2, Loader2, Check, X, ToggleLeft, ToggleRight } from "lucide-react";
import {
  useAppContext,
  GifticonOrder,
  GifticonCatalogItem,
  GifticonStatus,
} from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { formatPoints } from "@/lib/utils";

type Tab = "requests" | "catalog";

const STATUS_META: Record<GifticonStatus, { label: string; cls: string }> = {
  requested: { label: "발급 대기중", cls: "bg-amber-100 text-amber-700" },
  fulfilled: { label: "발급 완료", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "거절됨", cls: "bg-red-100 text-red-600" },
  canceled: { label: "취소됨", cls: "bg-gray-100 text-gray-500" },
  used: { label: "사용 완료", cls: "bg-blue-100 text-blue-600" },
};

export default function ParentGifticonsPage() {
  const [, setLocation] = useLocation();
  const {
    parent,
    gifticonOrders,
    gifticonCatalog,
    refreshGifticonOrders,
    refreshGifticonCatalog,
    fulfillGifticonOrderByParent,
    rejectGifticonOrderByParent,
    createGifticonCatalogItem,
    deleteGifticonCatalogItem,
  } = useAppContext();

  const [tab, setTab] = useState<Tab>("requests");
  const [fulfilling, setFulfilling] = useState<GifticonOrder | null>(null);
  const [rejecting, setRejecting] = useState<GifticonOrder | null>(null);

  useEffect(() => {
    if (!parent) {
      setLocation("/");
      return;
    }
    void refreshGifticonOrders();
    void refreshGifticonCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent]);

  if (!parent) return null;

  const requested = gifticonOrders.filter((o) => o.status === "requested");
  const past = gifticonOrders.filter((o) => o.status !== "requested");

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-16">
      <div className="px-4 py-4 flex items-center relative border-b border-gray-50 bg-white">
        <button
          onClick={() => setLocation("/parent/dashboard")}
          className="p-2 absolute left-4 text-gray-600 hover:bg-gray-100 rounded-full"
          data-testid="btn-back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="w-full text-center text-lg font-bold text-gray-900">🎁 기프티콘 관리</h1>
      </div>

      <div className="px-6 pt-5 pb-1">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("requests")}
            className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all relative ${
              tab === "requests" ? "bg-gray-900 text-white shadow-sm" : "bg-white text-gray-500 border border-gray-200"
            }`}
            data-testid="tab-requests"
          >
            구매 요청
            {requested.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-amber-400 text-white text-[11px] font-black rounded-full flex items-center justify-center">
                {requested.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("catalog")}
            className={`flex-1 py-2.5 rounded-full text-sm font-bold transition-all ${
              tab === "catalog" ? "bg-gray-900 text-white shadow-sm" : "bg-white text-gray-500 border border-gray-200"
            }`}
            data-testid="tab-catalog"
          >
            상품 관리
          </button>
        </div>
      </div>

      {tab === "requests" ? (
        <div className="px-6 pt-4 space-y-3">
          {requested.length === 0 && past.length === 0 ? (
            <EmptyCard emoji="🎁" text="아직 들어온 구매 요청이 없어요" />
          ) : (
            <>
              {requested.map((o) => (
                <RequestCard
                  key={o.id}
                  order={o}
                  onFulfill={() => setFulfilling(o)}
                  onReject={() => setRejecting(o)}
                />
              ))}
              {past.length > 0 && (
                <>
                  <p className="text-xs font-bold text-gray-400 pt-3 pl-1">지난 요청</p>
                  {past.map((o) => (
                    <PastCard key={o.id} order={o} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <CatalogTab
          catalog={gifticonCatalog}
          onCreate={createGifticonCatalogItem}
          onDelete={deleteGifticonCatalogItem}
        />
      )}

      {fulfilling && (
        <FulfillSheet
          order={fulfilling}
          onClose={() => setFulfilling(null)}
          onSubmit={async (issued) => {
            await fulfillGifticonOrderByParent(fulfilling.id, issued);
            toast({ title: "발급 완료! 바로 사용 완료로 처리됐어요 🎁" });
            setFulfilling(null);
          }}
        />
      )}

      {rejecting && (
        <RejectSheet
          order={rejecting}
          onClose={() => setRejecting(null)}
          onSubmit={async (reason) => {
            await rejectGifticonOrderByParent(rejecting.id, reason);
            toast({ title: "거절하고 환불했어요." });
            setRejecting(null);
          }}
        />
      )}
    </div>
  );
}

function EmptyCard({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="bg-white rounded-[24px] p-10 text-center shadow-sm border border-gray-100">
      <p className="text-4xl mb-3">{emoji}</p>
      <p className="text-gray-500 font-medium">{text}</p>
    </div>
  );
}

function RequestCard({
  order,
  onFulfill,
  onReject,
}: {
  order: GifticonOrder;
  onFulfill: () => void;
  onReject: () => void;
}) {
  return (
    <div className="bg-white rounded-[20px] p-4 shadow-sm border border-gray-100" data-testid={`req-${order.id}`}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-[14px] bg-gray-50 flex items-center justify-center text-2xl flex-shrink-0">
          {order.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-400 font-bold">{order.brand}</p>
          <p className="text-sm font-bold text-gray-900 truncate">{order.productName}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {order.childAvatar} {order.childName}
          </p>
        </div>
        <p className="text-sm font-black text-gray-900">{formatPoints(order.price)}</p>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onFulfill}
          className="flex-1 h-10 rounded-[14px] bg-gradient-to-r from-primary to-accent text-white font-bold text-sm flex items-center justify-center gap-1.5 active:opacity-90"
          data-testid={`btn-fulfill-${order.id}`}
        >
          <Check className="w-4 h-4" /> 발급하기
        </button>
        <button
          onClick={onReject}
          className="px-5 h-10 rounded-[14px] bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center gap-1.5 active:bg-gray-200"
          data-testid={`btn-reject-${order.id}`}
        >
          <X className="w-4 h-4" /> 거절
        </button>
      </div>
    </div>
  );
}

function PastCard({ order }: { order: GifticonOrder }) {
  const meta = STATUS_META[order.status];
  return (
    <div className="bg-white rounded-[20px] p-4 shadow-sm border border-gray-100 opacity-90" data-testid={`past-${order.id}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[12px] bg-gray-50 flex items-center justify-center text-xl flex-shrink-0">
          {order.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">
            {order.brand} {order.productName}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {order.childAvatar} {order.childName}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.cls}`}>
            {meta.label}
          </span>
          <p className="text-xs font-black text-gray-900 mt-1">{formatPoints(order.price)}</p>
        </div>
      </div>
      {order.status === "rejected" && order.rejectReason && (
        <p className="mt-3 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">사유: {order.rejectReason}</p>
      )}
    </div>
  );
}

const EMOJI_PALETTE = [
  "🎁", "🎀", "🍫", "🍪", "🍩", "🍰", "🎂", "🧁", "🍦", "🍿",
  "🥤", "☕", "🧋", "🍔", "🍕", "🍗", "🍟", "🌭", "🥪", "🍙",
  "🍜", "🎮", "🕹️", "📚", "✏️", "🎨", "🧸", "🪀", "⚽", "🏀",
  "🎫", "🎬", "🎵", "💎", "👟", "🧢", "💄", "🌸", "🚲", "🛹",
];

function CatalogTab({
  catalog,
  onCreate,
  onDelete,
}: {
  catalog: GifticonCatalogItem[];
  onCreate: (data: { brand: string; productName: string; price: number; isVariablePrice?: boolean; emoji?: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [brand, setBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [emoji, setEmoji] = useState("🎁");
  const [isVariablePrice, setIsVariablePrice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const numPrice = parseInt(price.replace(/,/g, ""), 10);
  const priceValid = isVariablePrice || (!isNaN(numPrice) && numPrice > 0);
  const valid = brand.trim() !== "" && productName.trim() !== "" && priceValid;

  const handleCreate = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await onCreate({
        brand: brand.trim(),
        productName: productName.trim(),
        price: isVariablePrice ? 0 : numPrice,
        isVariablePrice,
        emoji: emoji || undefined,
      });
      toast({ title: "상품을 등록했어요 🎁" });
      setBrand("");
      setProductName("");
      setPrice("");
      setEmoji("🎁");
      setIsVariablePrice(false);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "등록에 실패했어요.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await onDelete(id);
      toast({ title: "상품을 삭제했어요." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "삭제에 실패했어요.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="px-6 pt-4 space-y-5">
      <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 space-y-3">
        <p className="text-sm font-bold text-gray-700">새 상품 등록</p>

        <div>
          <p className="text-xs font-bold text-gray-500 mb-2">아이콘 선택</p>
          <div className="grid grid-cols-8 gap-1.5">
            {EMOJI_PALETTE.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`aspect-square rounded-[12px] flex items-center justify-center text-xl transition-all ${
                  emoji === e ? "bg-primary/10 ring-2 ring-primary" : "bg-gray-50 hover:bg-gray-100"
                }`}
                data-testid={`emoji-${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <Input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="브랜드 (예: 스타벅스)"
          className="rounded-[14px] border-gray-200"
          data-testid="input-brand"
        />
        <Input
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="상품명 (예: 아메리카노)"
          className="rounded-[14px] border-gray-200"
          data-testid="input-product"
        />

        <button
          onClick={() => setIsVariablePrice((v) => !v)}
          className="w-full flex items-center justify-between bg-gray-50 rounded-[14px] px-4 py-3 border border-gray-200"
          data-testid="toggle-variable-price"
        >
          <span className="text-left">
            <span className="text-sm font-bold text-gray-700 block">금액권 (자유 금액)</span>
            <span className="text-[11px] text-gray-400">아이가 살 때 직접 금액을 정해요</span>
          </span>
          {isVariablePrice ? (
            <ToggleRight className="w-7 h-7 text-primary flex-shrink-0" />
          ) : (
            <ToggleLeft className="w-7 h-7 text-gray-300 flex-shrink-0" />
          )}
        </button>

        {!isVariablePrice && (
          <div className="relative">
            <Input
              value={price}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setPrice(v ? parseInt(v, 10).toLocaleString("ko-KR") : "");
              }}
              placeholder="0"
              inputMode="numeric"
              className="text-right pr-10 rounded-[14px] border-gray-200"
              data-testid="input-price"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">P</span>
          </div>
        )}

        <Button
          onClick={handleCreate}
          disabled={!valid || saving}
          className="w-full h-12 rounded-[14px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
          data-testid="btn-create-item"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />} 상품 등록
        </Button>
      </div>

      {catalog.length === 0 ? (
        <EmptyCard emoji="🛒" text="등록된 상품이 없어요. 위에서 추가해보세요" />
      ) : (
        <div className="space-y-2">
          {catalog.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-[18px] p-3 shadow-sm border border-gray-100 flex items-center gap-3"
              data-testid={`cat-item-${item.id}`}
            >
              <div className="w-11 h-11 rounded-[12px] bg-gray-50 flex items-center justify-center text-2xl flex-shrink-0">
                {item.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-400 font-bold">{item.brand}</p>
                <p className="text-sm font-bold text-gray-900 truncate">{item.productName}</p>
              </div>
              <p className="text-sm font-black text-gray-900">{item.isVariablePrice ? "금액 자유" : formatPoints(item.price)}</p>
              <button
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                className="p-2 text-gray-300 hover:text-red-500 disabled:opacity-50"
                data-testid={`btn-delete-${item.id}`}
              >
                {deletingId === item.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FulfillSheet({
  order,
  onClose,
  onSubmit,
}: {
  order: GifticonOrder;
  onClose: () => void;
  onSubmit: (issued: { issuedPin?: string; issuedBarcode?: string; issuedImageUrl?: string }) => Promise<void>;
}) {
  const [pin, setPin] = useState(() => {
    const random = globalThis.crypto?.getRandomValues
      ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
      : Math.floor(Math.random() * 1_000_000);
    return `5025-${String(order.id).padStart(6, "0")}-${String(random).padStart(6, "0")}`;
  });
  const [barcode, setBarcode] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    setBusy(true);
    try {
      const issued: { issuedPin?: string; issuedBarcode?: string; issuedImageUrl?: string } = {};
      if (pin.trim()) issued.issuedPin = pin.trim();
      if (barcode.trim()) issued.issuedBarcode = barcode.trim();
      if (imageUrl.trim()) issued.issuedImageUrl = imageUrl.trim();
      await onSubmit(issued);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "발급에 실패했어요.", variant: "destructive" });
      setBusy(false);
    }
  };

  return (
    <Sheet title="기프티콘 발급" onClose={busy ? () => {} : onClose}>
      <div className="flex flex-col items-center text-center py-2 mb-2">
        <div className="w-16 h-16 rounded-[18px] bg-gray-50 flex items-center justify-center text-3xl mb-2">
          {order.emoji}
        </div>
        <p className="text-sm text-gray-400 font-bold">{order.brand}</p>
        <p className="text-lg font-bold text-gray-900">{order.productName}</p>
      </div>
      <p className="text-xs text-gray-400 text-center mb-4 leading-relaxed">
        발급 코드는 자동으로 만들어져요. 필요하면 직접 수정할 수 있어요.
        <br />
        발급하면 바로 사용 완료로 처리돼요.
      </p>
      <div className="space-y-2.5">
        <Input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="발급 코드"
          className="rounded-[14px] border-gray-200"
          data-testid="input-pin"
        />
        <Input
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="바코드 번호 (선택)"
          className="rounded-[14px] border-gray-200"
          data-testid="input-barcode"
        />
        <Input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="이미지 URL (선택)"
          className="rounded-[14px] border-gray-200"
          data-testid="input-image"
        />
      </div>
      <Button
        onClick={handleSubmit}
        disabled={busy}
        className="mt-5 w-full h-[52px] rounded-[16px] font-bold bg-gradient-to-r from-primary to-accent text-white"
        data-testid="btn-submit-fulfill"
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5 mr-1" />} 발급 완료
      </Button>
    </Sheet>
  );
}

function RejectSheet({
  order,
  onClose,
  onSubmit,
}: {
  order: GifticonOrder;
  onClose: () => void;
  onSubmit: (reason?: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    setBusy(true);
    try {
      await onSubmit(reason.trim() || undefined);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "거절에 실패했어요.", variant: "destructive" });
      setBusy(false);
    }
  };

  return (
    <Sheet title="구매 거절" onClose={busy ? () => {} : onClose}>
      <div className="flex flex-col items-center text-center py-2 mb-3">
        <div className="w-16 h-16 rounded-[18px] bg-gray-50 flex items-center justify-center text-3xl mb-2">
          {order.emoji}
        </div>
        <p className="text-lg font-bold text-gray-900">
          {order.brand} {order.productName}
        </p>
        <p className="text-sm text-gray-400 mt-1">거절하면 {formatPoints(order.price)}가 환불돼요.</p>
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="거절 사유 (선택, 아이에게 보여요)"
        maxLength={500}
        rows={3}
        className="w-full rounded-[14px] border border-gray-200 p-3 text-sm focus:outline-none focus:border-primary resize-none"
        data-testid="input-reason"
      />
      <Button
        onClick={handleSubmit}
        disabled={busy}
        className="mt-4 w-full h-[52px] rounded-[16px] font-bold bg-red-500 hover:bg-red-600 text-white"
        data-testid="btn-submit-reject"
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <X className="w-5 h-5 mr-1" />} 거절하고 환불
      </Button>
    </Sheet>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
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
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 bg-gray-50 rounded-full" data-testid="btn-close-sheet">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </motion.div>
    </>
  );
}
