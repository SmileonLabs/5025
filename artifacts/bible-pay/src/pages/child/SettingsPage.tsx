import { useLocation } from "wouter";
import { Bell, HelpCircle, Info, LogOut, ChevronRight } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { BottomNav } from "@/components/BottomNav";

export default function SettingsPage() {
  const [_, setLocation] = useLocation();
  const { selectedChildId, children, setRole, setSelectedChildId } = useAppContext();

  const child = children.find(c => c.id === selectedChildId);

  if (!child) {
    setLocation("/login");
    return null;
  }

  const handleLogout = () => {
    setRole(null);
    setSelectedChildId(null);
    setLocation("/login");
  };

  const menuItems = [
    { icon: Bell, label: "알림 설정", color: "text-blue-500", bg: "bg-blue-50" },
    { icon: HelpCircle, label: "부모님께 요청하기", color: "text-secondary-foreground", bg: "bg-secondary/20" },
    { icon: Info, label: "앱 정보", color: "text-gray-500", bg: "bg-gray-100" },
  ];

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-24">
      <div className="bg-white px-6 pt-12 pb-4 sticky top-0 z-40 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <h1 className="text-xl font-bold text-gray-900 text-center">설정</h1>
      </div>

      <div className="px-6 pt-6 space-y-6">
        {/* Profile Card */}
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-3xl">
            {child.avatar}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{child.name}</h2>
            <p className="text-gray-500 font-medium">{child.age}세</p>
          </div>
        </div>

        {/* Menu List */}
        <div className="bg-white rounded-[24px] overflow-hidden shadow-sm border border-gray-100">
          {menuItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <button 
                key={i}
                className="w-full flex items-center justify-between p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.bg} ${item.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-gray-700">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            );
          })}
        </div>

        {/* Logout */}
        <button 
          onClick={handleLogout}
          className="w-full bg-white rounded-[24px] p-4 shadow-sm border border-gray-100 flex items-center justify-center gap-2 text-destructive font-bold hover:bg-red-50 transition-colors"
          data-testid="btn-logout"
        >
          <LogOut className="w-5 h-5" /> 로그아웃
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
