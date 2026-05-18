import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import Splash from './components/Splash.jsx';
import TopProgress, { RouteSuspenseFallback } from './components/TopProgress.jsx';

// Public pages stay eager — they're the first thing a visitor sees.
import Login from './pages/Login.jsx';
import RegisterRequest from './pages/RegisterRequest.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

// Everything below is code-split: a fresh user only downloads the chunk for
// the surface they actually visit. The Suspense fallback below shows the top
// progress bar while a chunk is in flight.
const Home              = lazy(() => import('./pages/Home.jsx'));
const DeviceDetail      = lazy(() => import('./pages/DeviceDetail.jsx'));
const AdminLogin        = lazy(() => import('./pages/admin/Login.jsx'));
const AdminDashboard    = lazy(() => import('./pages/admin/Dashboard.jsx'));
const AdminUsers        = lazy(() => import('./pages/admin/Users.jsx'));
const AdminDevices      = lazy(() => import('./pages/admin/Devices.jsx'));
const AddUser           = lazy(() => import('./pages/admin/AddUser.jsx'));
const EditUser          = lazy(() => import('./pages/admin/EditUser.jsx'));
const RegisterRequests  = lazy(() => import('./pages/admin/RegisterRequests.jsx'));

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

// Wraps the active route in a fading container keyed by pathname so each
// navigation visibly re-mounts and replays the page-fade animation. No
// dependency on a routing-animation library.
function PageFrame({ children }) {
  const loc = useLocation();
  return (
    <div key={loc.pathname} className="page-fade">
      {children}
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();

  return (
    <>
      <Splash done={!loading} />
      <TopProgress />
      <Suspense fallback={<RouteSuspenseFallback />}>
        <PageFrame>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/register-request" element={<RegisterRequest />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/home" element={<UserOnly><Home /></UserOnly>} />
            <Route path="/devices/:id" element={<UserOnly><DeviceDetail /></UserOnly>} />

            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/home" element={<AdminOnly><AdminDashboard /></AdminOnly>} />
            <Route path="/admin/users" element={<AdminOnly><AdminUsers /></AdminOnly>} />
            <Route path="/admin/devices" element={<AdminOnly><AdminDevices /></AdminOnly>} />
            <Route path="/admin/register-requests" element={<AdminOnly><RegisterRequests /></AdminOnly>} />
            <Route path="/admin/add-user" element={<AdminOnly><AddUser /></AdminOnly>} />
            <Route path="/admin/edit-user/:id" element={<AdminOnly><EditUser /></AdminOnly>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PageFrame>
      </Suspense>
    </>
  );
}
