import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';

import Login from './pages/Login.jsx';
import RegisterRequest from './pages/RegisterRequest.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Home from './pages/Home.jsx';

import AdminLogin from './pages/admin/Login.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminUsers from './pages/admin/Users.jsx';
import AddUser from './pages/admin/AddUser.jsx';
import EditUser from './pages/admin/EditUser.jsx';
import RegisterRequests from './pages/admin/RegisterRequests.jsx';

function UserOnly({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return null;
  return user ? children : <Navigate to="/" replace state={{ from: loc }} />;
}

function AdminOnly({ children }) {
  const { admin, loading } = useAuth();
  const loc = useLocation();
  if (loading) return null;
  return admin ? children : <Navigate to="/admin" replace state={{ from: loc }} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register-request" element={<RegisterRequest />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/home"
        element={
          <UserOnly>
            <Home />
          </UserOnly>
        }
      />

      <Route path="/admin" element={<AdminLogin />} />
      <Route
        path="/admin/home"
        element={
          <AdminOnly>
            <AdminDashboard />
          </AdminOnly>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminOnly>
            <AdminUsers />
          </AdminOnly>
        }
      />
      <Route
        path="/admin/register-requests"
        element={
          <AdminOnly>
            <RegisterRequests />
          </AdminOnly>
        }
      />
      <Route
        path="/admin/add-user"
        element={
          <AdminOnly>
            <AddUser />
          </AdminOnly>
        }
      />
      <Route
        path="/admin/edit-user/:id"
        element={
          <AdminOnly>
            <EditUser />
          </AdminOnly>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
