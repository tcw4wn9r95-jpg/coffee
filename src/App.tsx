import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { hasKey, loadSettings } from "./lib/settings";
import { ToastProvider } from "./components/Toast";
import { TabBar } from "./components/TabBar";
import { Onboarding } from "./features/Onboarding";
import { Home } from "./features/Home";
import { NewCoffee } from "./features/NewCoffee";
import { CoffeeDetail } from "./features/CoffeeDetail";
import { Settings } from "./features/Settings";
import { Maintenance, MaintenanceTask } from "./features/Maintenance";

function RequireSetup({ children }: { children: React.ReactNode }) {
  const settings = loadSettings();
  // First run: no key and never onboarded → send to welcome.
  if (!settings.onboarded && !hasKey()) {
    return <Navigate to="/welcome" replace />;
  }
  return <>{children}</>;
}

function Shell() {
  const { pathname } = useLocation();
  const showTabs = pathname !== "/welcome";
  return (
    <div className="app">
      <Routes>
        <Route path="/welcome" element={<Onboarding />} />
        <Route
          path="/"
          element={
            <RequireSetup>
              <Home />
            </RequireSetup>
          }
        />
        <Route path="/new" element={<NewCoffee />} />
        <Route path="/coffee/:id" element={<CoffeeDetail />} />
        <Route path="/care" element={<Maintenance />} />
        <Route path="/care/:id" element={<MaintenanceTask />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showTabs && <TabBar />}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </ToastProvider>
  );
}
