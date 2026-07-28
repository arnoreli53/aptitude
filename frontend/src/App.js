import React from "react";
import "@/App.css";
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  useLocation
} from "react-router-dom";
import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import AdminSettings from "./pages/AdminSettings";
import ModuleRouter from "./pages/ModuleRouter";
import GamepadCalibration from "./pages/GamepadCalibration";
import ScoreHistory from "./pages/ScoreHistory";
import ScoreView from "./pages/ScoreView";
import Account from "./pages/Account";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import SubscriptionCancel from "./pages/SubscriptionCancel";
import AuthPage from "./pages/AuthPage";
import AuthVerify from "./pages/AuthVerify";
import ResetPassword from "./pages/ResetPassword";

const PrivatePage = ({ children }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

function AppRoutes() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const showHeader = !loading && user && !location.pathname.startsWith('/auth');

  return (
    <>
      {showHeader && <Header />}
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/verify" element={<AuthVerify />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<PrivatePage><Dashboard /></PrivatePage>} />
        <Route path="/settings" element={<PrivatePage><AdminSettings /></PrivatePage>} />
        <Route path="/admin" element={<Navigate to="/settings" replace />} />
        <Route path="/module/:moduleId" element={<PrivatePage><ModuleRouter /></PrivatePage>} />
        <Route path="/gamepad" element={<PrivatePage><GamepadCalibration /></PrivatePage>} />
        <Route path="/scores" element={<PrivatePage><ScoreView /></PrivatePage>} />
        <Route path="/history" element={<PrivatePage><ScoreHistory /></PrivatePage>} />
        <Route path="/history/:moduleId" element={<PrivatePage><ScoreHistory /></PrivatePage>} />
        <Route path="/account" element={<PrivatePage><Account /></PrivatePage>} />
        <Route path="/subscription/success" element={<SubscriptionSuccess />} />
        <Route path="/subscription/cancel" element={<SubscriptionCancel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
