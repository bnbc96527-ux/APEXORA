import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AdaptiveLayout } from './components/Layout';
import { ToastContainer } from './components/Toast';
import { TradePage } from './pages/TradePage';
import { MarketsPage } from './pages/MarketsPage';
import { WalletPage } from './pages/WalletPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { LandingPage } from './pages/LandingPage';
import { ManagementPage } from './pages/ManagementPage';
import { useAuthStore } from './store/authStore';

// Private Route Component
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const RoleRoute = ({ allow, children }: { allow: Array<'boss' | 'admin' | 'user'>; children: React.ReactNode }) => {
  const { isAuthenticated, user, sessionReady } = useAuthStore();
  if (!sessionReady) return <div className="app-container" style={{ display: 'grid', placeItems: 'center', color: 'white' }}>Loading secure session...</div>;
  if (!isAuthenticated || !user) return <Navigate to="/auth" replace />;
  if (!allow.includes(user.role)) return <Navigate to="/trade" replace />;
  return <>{children}</>;
};

// Auth page wrapper - standalone without layout
function AuthPageWrapper() {
  return (
    <div className="app-container">
      <AuthPage />
      <ToastContainer />
    </div>
  );
}

// Landing page wrapper - standalone without layout
function LandingPageWrapper() {
  return (
    <div className="app-container">
      <LandingPage />
      <ToastContainer />
    </div>
  );
}

export function App() {
  const location = useLocation();
  const { isAuthenticated, user, sessionReady } = useAuthStore();

  if (!sessionReady) {
    return (
      <div className="app-container" style={{ display: 'grid', placeItems: 'center', color: 'white', minHeight: '100vh' }}>
        Loading secure session...
      </div>
    );
  }

  // Auth page is rendered standalone without the adaptive layout
  if (location.pathname === '/auth') {
    return <AuthPageWrapper />;
  }

  // Landing page is rendered standalone without the adaptive layout
  if (location.pathname === '/' && !isAuthenticated) {
    return <LandingPageWrapper />;
  }

  // Redirect to landing if not authenticated and not on auth
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route element={<AdaptiveLayout />}>
        <Route
          path="/manage"
          element={
            <RoleRoute allow={['boss', 'admin']}>
              <ManagementPage />
            </RoleRoute>
          }
        />
        <Route path="/trade" element={<PrivateRoute><TradePage /></PrivateRoute>} />
        <Route path="/markets" element={<PrivateRoute><MarketsPage /></PrivateRoute>} />
        <Route path="/wallet" element={<PrivateRoute><WalletPage /></PrivateRoute>} />
        <Route path="/assets" element={<PrivateRoute><AssetDetailPage /></PrivateRoute>} />
        <Route path="/orders" element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
        <Route path="/" element={<Navigate to="/trade" replace />} />
        <Route path="*" element={<Navigate to="/trade" replace />} />
      </Route>
    </Routes>
  );
}
