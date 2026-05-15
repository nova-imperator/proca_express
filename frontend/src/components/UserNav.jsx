import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import BrandMark from './BrandMark.jsx';

export default function UserNav() {
  const { user, logoutUser } = useAuth();
  return (
    <header className="site-header">
      <Link to={user ? '/home' : '/'} className="brand">
        <BrandMark size={22} />
        <span>Proca Express</span>
      </Link>
      <nav>
        {user ? (
          <>
            <Link to="/home">Dashboard</Link>
            <button className="link-button" onClick={logoutUser}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/">Sign in</Link>
            <Link to="/register-request">Register request</Link>
          </>
        )}
      </nav>
    </header>
  );
}
