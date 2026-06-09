import { Book } from "lucide-react";

export function BibleIllustration() {
  return (
    <div className="w-full h-[140px] rounded-[20px] bg-gradient-to-br from-primary/30 via-secondary/30 to-accent/30 flex items-center justify-center shadow-inner relative overflow-hidden">
      <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px]"></div>
      <div className="relative z-10 flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-white/80 flex items-center justify-center shadow-sm animate-pulse-slow">
          <Book className="w-8 h-8 text-primary-foreground" />
        </div>
        <div className="absolute -top-4 -left-4 text-2xl animate-bounce" style={{ animationDelay: "0ms" }}>✨</div>
        <div className="absolute top-0 -right-6 text-xl animate-bounce" style={{ animationDelay: "200ms" }}>✨</div>
        <div className="absolute -bottom-2 left-6 text-xl animate-bounce" style={{ animationDelay: "400ms" }}>🌟</div>
      </div>
    </div>
  );
}
