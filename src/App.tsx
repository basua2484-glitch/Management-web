import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import SupervisorDashboard from './pages/SupervisorDashboard';
import StaffDashboard from './pages/StaffDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import { UnauthorizedPage } from './components/UnauthorizedPage';
import { AuthLoadingScreen } from './components/AuthLoadingScreen';

const LogoutRoute: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    logout(navigate);
  }, [logout, navigate]);

  return <AuthLoadingScreen message="Signing out and clearing session..." />;
};

const RootRedirect: React.FC = () => {
  const { isAuthenticated, isLoading, role } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated && role) {
    const dest =
      role === 'ADMIN'
        ? '/admin/dashboard'
        : role === 'MANAGER'
        ? '/manager-dashboard'
        : role === 'SUPERVISOR'
        ? '/supervisor/dashboard'
        : '/staff/dashboard';
    return <Navigate to={dest} replace />;
  }

  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Default URL (`/`) -> Directly renders LoginPage so anyone opening the app lands on the Login Interface first */}
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* 1. Admin Dashboard Route */}
          <Route 
            path="/admin/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route path="/admin-dashboard" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin-geofence" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />

          {/* Manager Dashboard Route */}
          <Route 
            path="/manager-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <ManagerDashboard />
              </ProtectedRoute>
            } 
          />

          {/* 2. Supervisor Dashboard Route with On-Duty Check */}
          <Route 
            path="/supervisor/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'SUPERVISOR']}>
                <SupervisorDashboard />
              </ProtectedRoute>
            } 
          />
          <Route path="/supervisor-dashboard" element={<Navigate to="/supervisor/dashboard" replace />} />

          {/* 3. Staff Dashboard Route */}
          <Route 
            path="/staff/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'SUPERVISOR', 'STAFF']}>
                <StaffDashboard />
              </ProtectedRoute>
            } 
          />
          <Route path="/staff-portal" element={<Navigate to="/staff/dashboard" replace />} />

          {/* Access Denied (Case B Redirect) */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Session Clear & Logout Route */}
          <Route path="/logout" element={<LogoutRoute />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
