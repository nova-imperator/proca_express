import { useEffect, useState } from 'react';
import BrandMark from './BrandMark.jsx';

// Full-screen splash shown on first app load until AuthContext finishes its
// initial /me checks. Fades out smoothly so the page underneath doesn't pop in.
export default function Splash({ done }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setHidden(true), 380); // matches CSS fadeOut
    return () => clearTimeout(t);
  }, [done]);

  if (hidden) return null;

  return (
    <div className={`splash ${done ? 'is-out' : ''}`} aria-hidden={done}>
      <div className="splash-inner">
        <div className="splash-mark">
          <BrandMark size={40} />
        </div>
        <div className="splash-name">Proca Express</div>
        <div className="splash-bar" role="progressbar" aria-label="Loading" />
      </div>
    </div>
  );
}
