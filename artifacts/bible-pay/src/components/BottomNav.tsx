import { Link, useLocation } from "wouter";
import { Home, Star, Gift, BookOpen, Settings } from "lucide-react";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { href: "/child/home", label: "홈", icon: Home },
    { href: "/child/missions", label: "미션", icon: Star },
    { href: "/child/shop", label: "상점", icon: Gift },
    { href: "/child/ledger", label: "기입장", icon: BookOpen },
    { href: "/child/settings", label: "설정", icon: Settings }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.02)] pb-[env(safe-area-inset-bottom,16px)] z-50">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex-1 h-full">
              <div 
                data-testid={`nav-${item.href.split("/").pop()}`}
                className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${
                  isActive ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors ${isActive ? 'bg-primary/20' : ''}`}>
                  <Icon 
                    className={`w-5 h-5 transition-transform ${isActive ? "scale-110" : "scale-100"}`} 
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
                <span className={`text-[10px] font-medium ${isActive ? "opacity-100" : "opacity-80"}`}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
