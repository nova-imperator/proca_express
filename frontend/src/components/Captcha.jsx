import { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { api } from '../api';

/**
 * Math captcha widget.
 *
 * Props:
 *   onChange({ token, answer })   fired on every keystroke
 *
 * Imperative methods (via ref):
 *   refresh()  — fetch a brand-new challenge (call this after a failed login)
 *
 * Renders nothing while the first challenge is loading; doesn't block submit
 * — the page can decide whether to require it.
 */
const Captcha = forwardRef(function Captcha({ onChange }, ref) {
  const [token, setToken] = useState('');
  const [challenge, setChallenge] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setAnswer('');
    try {
      const data = await api.get('/api/captcha');
      setToken(data.token);
      setChallenge(data.challenge);
      onChange?.({ token: data.token, answer: '' });
    } catch {
      setError('Could not load captcha.');
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useImperativeHandle(ref, () => ({ refresh: load }), [load]);

  const onTyping = (e) => {
    const v = e.target.value;
    setAnswer(v);
    onChange?.({ token, answer: v });
  };

  return (
    <div className="captcha-box">
      <div className="captcha-row">
        <div className="captcha-q">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               style={{ verticalAlign: '-3px', marginRight: 6, color: 'var(--muted)' }}>
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Z"/>
            <path d="M11 11h2v6h-2zM12 7a1.25 1.25 0 1 0 1.25 1.25A1.25 1.25 0 0 0 12 7Z"/>
          </svg>
          <span>{loading ? 'Loading…' : (error || challenge || '—')}</span>
        </div>
        <button type="button" className="captcha-refresh" onClick={load} aria-label="Refresh captcha" title="New challenge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      </div>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Type the answer"
        value={answer}
        onChange={onTyping}
        className="captcha-input"
      />
    </div>
  );
});

export default Captcha;
