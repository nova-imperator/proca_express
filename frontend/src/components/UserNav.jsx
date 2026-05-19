import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import BrandMark from './BrandMark.jsx';
import { MenuIcon, CloseIcon } from './NavIcons.jsx';

export default function UserNav() {
  const { user, logoutUser } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('nav-locked');
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('nav-locked');
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onLogout = async () => { close(); await logoutUser(); };

  return (
    <header className="site-header">
      <Link to={user ? '/home' : '/'} className="brand" onClick={close}>
        <BrandMark size={22} />
        <span>Cargoverse</span>
      </Link>

      <button className="nav-toggle" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
        <MenuIcon />
      </button>

      <nav className={open ? 'is-open' : ''} aria-label="Primary">
        <button className="nav-close" onClick={close} aria-label="Close menu">
          <CloseIcon />
        </button>
        {user ? (
          <>
            <Link to="/home" onClick={close}>Dashboard</Link>
            <div className="nav-divider" aria-hidden="true" />
            <button className="link-button nav-logout" onClick={onLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/" onClick={close}>Sign in</Link>
            <Link to="/register-request" onClick={close}>Register request</Link>
          </>
        )}
      </nav>

      {open && <div className="nav-backdrop is-open" onClick={close} aria-hidden="true" />}
    </header>
  );
}
