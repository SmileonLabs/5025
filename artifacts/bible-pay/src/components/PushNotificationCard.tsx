import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { enablePush, disablePush, isPushSupported, isPushSubscribed, getPushPermission } from "@/lib/push";

export function PushNotificationCard() {
  const [supported] = useState(() => isPushSupported());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!supported) return;
    setDenied(getPushPermission() === "denied");
    isPushSubscribed().then(setSubscribed);
  }, [supported]);

  if (!supported) {
    return (
      <div className="bg-white rounded-[20px] p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <BellOff className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-sm">푸시 알림</p>
            <p className="text-xs text-gray-400 mt-0.5">이 기기는 푸시 알림을 지원하지 않아요.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleEnable = async () => {
    setBusy(true);
    setStatus(null);
    const result = await enablePush();
    setBusy(false);
    if (result.ok) {
      setSubscribed(true);
      setDenied(false);
      setStatus("알림이 켜졌어요! 아이가 용돈을 받거나 사용하면 알려드릴게요. 🔔");
    } else if (result.reason === "denied") {
      setDenied(true);
      setStatus("알림 권한이 거부되었어요. 브라우저 설정에서 허용해주세요.");
    } else if (result.reason === "unsupported") {
      setStatus("이 기기는 푸시 알림을 지원하지 않아요.");
    } else {
      setStatus("알림을 켜지 못했어요. 잠시 후 다시 시도해주세요.");
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setStatus(null);
    await disablePush();
    setBusy(false);
    setSubscribed(false);
    setStatus("알림을 껐어요.");
  };

  return (
    <div className="bg-white rounded-[20px] p-4 shadow-sm border border-gray-100" data-testid="card-push">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${subscribed ? "bg-primary/10" : "bg-gray-100"}`}>
          {subscribed ? <BellRing className="w-5 h-5 text-primary-foreground" /> : <Bell className="w-5 h-5 text-gray-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">푸시 알림</p>
          <p className="text-xs text-gray-400 mt-0.5">
            아이가 용돈을 받거나 사용하면 휴대폰으로 알려드려요.
          </p>
        </div>
        {subscribed ? (
          <button
            onClick={handleDisable}
            disabled={busy}
            className="px-3.5 h-9 rounded-full bg-gray-100 text-gray-600 text-sm font-bold disabled:opacity-50"
            data-testid="btn-push-disable"
          >
            끄기
          </button>
        ) : (
          <button
            onClick={handleEnable}
            disabled={busy}
            className="px-3.5 h-9 rounded-full bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
            data-testid="btn-push-enable"
          >
            {busy ? "..." : "켜기"}
          </button>
        )}
      </div>
      {status && (
        <p className="text-xs mt-3 text-gray-500 leading-relaxed bg-gray-50 rounded-xl px-3 py-2" data-testid="text-push-status">
          {status}
        </p>
      )}
      {denied && !status && (
        <p className="text-xs mt-3 text-gray-500 leading-relaxed bg-gray-50 rounded-xl px-3 py-2">
          브라우저에서 알림이 차단되어 있어요. 설정에서 허용해주세요.
        </p>
      )}
      <p className="text-[11px] text-gray-300 mt-2 leading-relaxed">
        아이폰은 홈 화면에 앱을 추가한 뒤 열어야 알림을 받을 수 있어요.
      </p>
    </div>
  );
}
