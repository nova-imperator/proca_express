import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Slim animated bar at the very top of the viewport. Becomes visible whenever
// the route changes; auto-hides after ~500ms. The bar itself is pure CSS —
// this just toggles a class.
export default function TopProgress() {
  const loc = useLocation();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    const t = setTimeout(() => setActive(false), 500);
    return () => clearTimeout(t);
  }, [loc.pathname]);

  return <div className={`top-progress ${active ? 'is-active' : ''}`} aria-hidden="true" />;
}

// Suspense fallback used while a lazy-loaded route chunk downloads.
export function RouteSuspenseFallback() {
  return <div className="top-progress is-active" aria-hidden="true" />;
}
