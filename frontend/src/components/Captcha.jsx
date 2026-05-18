import { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { api } from '../api';

/**
 * Image captcha widget.
 *
 * Renders the SVG returned by GET /api/captcha, plus an input where the
 * user types the answer. Image arrives as a base64 data URL so it goes
 * straight into <img src>.
 *
 * Props:   onChange({ token, answer })   fired on every keystroke
 * Ref:     refresh()                     pull a fresh challenge
 */
const Captcha = forwardRef(function Captcha({ onChange }, ref) {
  const [token, setToken] = useState('');
  const [image, setImage] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setAnswer('');
    try {
      const data = await api.get('/api/captcha');
      setToken(data.token);
      setImage(data.image);
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
      <div className="captcha-image-row">
        {image ? (
          <img src={image} alt="captcha" className="captcha-image" />
        ) : (
          <div className="captcha-image captcha-placeholder">{loading ? 'Loading…' : (error || '')}</div>
        )}
        <button
          type="button"
          className="captcha-refresh"
          onClick={load}
          aria-label="Refresh captcha"
          title="Get a new captcha"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      </div>
      <p className="captcha-help">Evaluate the arithmetic expression and enter the answer below.</p>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Answer"
        value={answer}
        onChange={onTyping}
        className="captcha-input"
      />
    </div>
  );
});

export default Captcha;
