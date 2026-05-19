import { useState, useEffect } from 'react';

/**
 * useState that mirrors its value into localStorage so it survives reloads
 * and full browser restarts on the same device. Use for UI preferences:
 * toggles, collapsed states, last-selected tabs — never for sensitive data.
 *
 * usage:
 *   const [showOnlyMine, setShowOnlyMine] = useLocalState('users.mine', false);
 */
export default function useLocalState(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (raw == null) return initial;
      return JSON.parse(raw);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(val));
    } catch {
      // quota exceeded / private mode — fail silently, preference just won't persist
    }
  }, [key, val]);

  return [val, setVal];
}
