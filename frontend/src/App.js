import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import POSPage from "@/pages/POSPage";
import CustomersPage from "@/pages/CustomersPage";
import OrdersPage from "@/pages/OrdersPage";
import ItemsPage from "@/pages/ItemsPage";
import ReportsPage from "@/pages/ReportsPage";
import MetricsPage from "@/pages/MetricsPage";
import SettingsPage from "@/pages/SettingsPage";
import StaffPage from "@/pages/StaffPage";
import DeliveryPage from "@/pages/DeliveryPage";
import PaymentSuccessPage from "@/pages/PaymentSuccessPage";
import Layout from "@/components/Layout";
import "@/App.css";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/payment-success" element={<PaymentSuccessPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/pos" element={<POSPage />} />
                    <Route path="/customers" element={<CustomersPage />} />
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/items" element={<ItemsPage />} />
                    <Route path="/delivery" element={<DeliveryPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/staff" element={<StaffPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
