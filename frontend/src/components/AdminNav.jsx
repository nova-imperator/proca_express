import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import BrandMark from './BrandMark.jsx';

export default function AdminNav() {
  const { admin, logoutAdmin } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const onLogout = async () => { await logoutAdmin(); nav('/admin'); };
  const linkClass = (to) => (pathname === to || pathname.startsWith(to + '/') ? 'active' : '');
  return (
    <header className="site-header admin">
      <Link to="/admin/home" className="brand">
        <BrandMark size={22} />
        <span>Proca Express · Admin</span>
      </Link>
      <nav>
        {admin && (
          <>
            <Link className={linkClass('/admin/home')} to="/admin/home">Dashboard</Link>
            <Link className={linkClass('/admin/devices')} to="/admin/devices">Devices</Link>
            <Link className={linkClass('/admin/users')} to="/admin/users">Users</Link>
            <Link className={linkClass('/admin/register-requests')} to="/admin/register-requests">Requests</Link>
            <Link className={linkClass('/admin/add-user')} to="/admin/add-user">Add user</Link>
            <button className="link-button" onClick={onLogout}>Logout</button>
          </>
        )}
      </nav>
    </header>
  );
}
