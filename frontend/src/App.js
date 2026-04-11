import { useEffect, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "@/pages/LandingPage";
import AuthCallback from "@/pages/AuthCallback";
import RoleSelection from "@/pages/RoleSelection";
import Dashboard from "@/pages/Dashboard";
import PatientsPage from "@/pages/PatientsPage";
import PatientProfile from "@/pages/PatientProfile";
import UploadPage from "@/pages/UploadPage";
import RiskResults from "@/pages/RiskResults";
import ChatPage from "@/pages/ChatPage";
import AlertsPage from "@/pages/AlertsPage";
import AdminPage from "@/pages/AdminPage";
import SettingsPage from "@/pages/SettingsPage";

function AppRouter() {
  const location = useLocation();
  // CRITICAL: Check for session_id synchronously during render to prevent race conditions
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/select-role" element={<ProtectedRoute><RoleSelection /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute requireRole><Dashboard /></ProtectedRoute>} />
      <Route path="/patients" element={<ProtectedRoute requireRole><PatientsPage /></ProtectedRoute>} />
      <Route path="/patients/:patientId" element={<ProtectedRoute requireRole><PatientProfile /></ProtectedRoute>} />
      <Route path="/upload/:patientId" element={<ProtectedRoute requireRole><UploadPage /></ProtectedRoute>} />
      <Route path="/results/:patientId" element={<ProtectedRoute requireRole><RiskResults /></ProtectedRoute>} />
      <Route path="/chat/:patientId" element={<ProtectedRoute requireRole><ChatPage /></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute requireRole><AlertsPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute requireRole><AdminPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute requireRole><SettingsPage /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
