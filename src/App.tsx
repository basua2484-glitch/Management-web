import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import StaffPortal from './pages/StaffPortal';
import ProtectedRoute from './components/ProtectedRoute';
import { UnauthorizedPage } from './components/UnauthorizedPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Default URL (`/`) -> Automatically goes to Login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          {/* Dynamic Secured Routes */}
          <Route 
            path="/admin-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/manager-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <ManagerDashboard />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/staff-portal" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'STAFF']}>
                <StaffPortal />
              </ProtectedRoute>
            } 
          />

          {/* Access Denied (Case B Redirect) */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Legacy & Shortcut Routes */}
          <Route path="/dashboard" element={<Navigate to="/admin-dashboard" replace />} />
          <Route path="/admin" element={<Navigate to="/admin-dashboard" replace />} />
          <Route path="/admin/dashboard" element={<Navigate to="/admin-dashboard" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
