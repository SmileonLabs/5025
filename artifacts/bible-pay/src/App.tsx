import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppProvider } from "@/context/AppContext";

import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/parent/DashboardPage";
import ChargePage from "@/pages/parent/ChargePage";
import HomePage from "@/pages/child/HomePage";
import MissionsPage from "@/pages/child/MissionsPage";
import LedgerPage from "@/pages/child/LedgerPage";
import SettingsPage from "@/pages/child/SettingsPage";

const queryClient = new QueryClient();

function RedirectToLogin() {
  return <LoginPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RedirectToLogin} />
      <Route path="/login" component={LoginPage} />
      
      <Route path="/parent/dashboard" component={DashboardPage} />
      <Route path="/parent/charge" component={ChargePage} />
      
      <Route path="/child/home" component={HomePage} />
      <Route path="/child/missions" component={MissionsPage} />
      <Route path="/child/ledger" component={LedgerPage} />
      <Route path="/child/settings" component={SettingsPage} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AppProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
