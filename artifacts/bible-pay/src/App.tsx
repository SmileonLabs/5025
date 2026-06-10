import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppProvider } from "@/context/AppContext";
import { SplashScreen } from "@/components/SplashScreen";

import LoginPage from "@/pages/LoginPage";
import ParentAuthPage from "@/pages/ParentAuthPage";
import ChildSelectPage from "@/pages/ChildSelectPage";
import DashboardPage from "@/pages/parent/DashboardPage";
import ChargePage from "@/pages/parent/ChargePage";
import ParentMissionsPage from "@/pages/parent/MissionsPage";
import HistoryPage from "@/pages/parent/HistoryPage";
import ParentGifticonsPage from "@/pages/parent/GifticonsPage";
import HomePage from "@/pages/child/HomePage";
import MissionsPage from "@/pages/child/MissionsPage";
import LedgerPage from "@/pages/child/LedgerPage";
import SettingsPage from "@/pages/child/SettingsPage";
import BibleChapterPage from "@/pages/child/BibleChapterPage";
import QuizPage from "@/pages/child/QuizPage";
import ShopPage from "@/pages/child/ShopPage";
import AdminPage from "@/pages/AdminPage";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={LoginPage} />
      <Route path="/login" component={LoginPage} />

      <Route path="/parent/auth" component={ParentAuthPage} />
      <Route path="/child/select" component={ChildSelectPage} />

      <Route path="/parent/dashboard" component={DashboardPage} />
      <Route path="/parent/charge" component={ChargePage} />
      <Route path="/parent/missions" component={ParentMissionsPage} />
      <Route path="/parent/history" component={HistoryPage} />
      <Route path="/parent/gifticons" component={ParentGifticonsPage} />

      <Route path="/child/home" component={HomePage} />
      <Route path="/child/missions" component={MissionsPage} />
      <Route path="/child/shop" component={ShopPage} />
      <Route path="/child/ledger" component={LedgerPage} />
      <Route path="/child/settings" component={SettingsPage} />
      <Route path="/child/bible/:missionId" component={BibleChapterPage} />
      <Route path="/child/quiz/:missionId" component={QuizPage} />

      <Route path="/admin" component={AdminPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    // Remove the instant static splash baked into index.html once React owns the UI.
    document.getElementById("app-splash")?.remove();
    const timer = setTimeout(() => setBooting(false), 1300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AppProvider>
        <Toaster />
        <AnimatePresence>{booting && <SplashScreen />}</AnimatePresence>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
