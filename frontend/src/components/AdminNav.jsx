import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import BrandMark from './BrandMark.jsx';
import { MenuIcon, CloseIcon } from './NavIcons.jsx';

export default function AdminNav() {
  const { admin, logoutAdmin } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  // Auto-close the drawer on route change + lock body scroll while open.
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

  const onLogout = async () => { close(); await logoutAdmin(); nav('/admin'); };
  const linkClass = (to) => (pathname === to || pathname.startsWith(to + '/') ? 'active' : '');

  return (
    <header className="site-header admin">
      <Link to="/admin/home" className="brand" onClick={close}>
        <BrandMark size={22} />
        <span>Cargoverse · Admin</span>
      </Link>

      <button className="nav-toggle" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
        <MenuIcon />
      </button>

      <nav className={open ? 'is-open' : ''} aria-label="Primary">
        <button className="nav-close" onClick={close} aria-label="Close menu">
          <CloseIcon />
        </button>
        {admin && (
          <>
            <Link className={linkClass('/admin/home')}              to="/admin/home"              onClick={close}>Dashboard</Link>
            <Link className={linkClass('/admin/devices')}           to="/admin/devices"           onClick={close}>Devices</Link>
            <Link className={linkClass('/admin/users')}             to="/admin/users"             onClick={close}>Users</Link>
            <Link className={linkClass('/admin/register-requests')} to="/admin/register-requests" onClick={close}>Requests</Link>
            <Link className={linkClass('/admin/add-user')}          to="/admin/add-user"          onClick={close}>Add user</Link>
            <div className="nav-divider" aria-hidden="true" />
            <button className="link-button nav-logout" onClick={onLogout}>Logout</button>
          </>
        )}
      </nav>

      {open && <div className="nav-backdrop is-open" onClick={close} aria-hidden="true" />}
    </header>
  );
}
