import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function AdminNav() {
  const { admin, logoutAdmin } = useAuth();
  const nav = useNavigate();
  const onLogout = async () => { await logoutAdmin(); nav('/admin'); };
  return (
    <header className="site-header admin">
      <Link to="/admin/home" className="brand">Proca Express · Admin</Link>
      <nav>
        {admin && (
          <>
            <Link to="/admin/home">Dashboard</Link>
            <Link to="/admin/users">Users</Link>
            <Link to="/admin/add-user">Add user</Link>
            <button className="link-button" onClick={onLogout}>Logout</button>
          </>
        )}
      </nav>
    </header>
  );
}
