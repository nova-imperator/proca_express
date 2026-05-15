import { useEffect, useRef } from 'react';

// Wraps Google reCAPTCHA v2 ("I'm not a robot" checkbox).
// - If siteKey is falsy, renders nothing so dev environments without a key still work.
// - On verify it calls onChange(token); on expiry/error onChange(null).
//
// The Google script is injected once globally and `window.grecaptcha` is awaited.

let scriptLoading = null;

function loadScript() {
  if (window.grecaptcha?.render) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
    s.async = true; s.defer = true;
    s.onload = () => {
      const wait = () => {
        if (window.grecaptcha && window.grecaptcha.render) resolve();
        else setTimeout(wait, 50);
      };
      wait();
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return scriptLoading;
}

export default function Recaptcha({ siteKey, onChange }) {
  const hostRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    if (!siteKey || !hostRef.current) return;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || widgetIdRef.current !== null) return;
      widgetIdRef.current = window.grecaptcha.render(hostRef.current, {
        sitekey: siteKey,
        callback: (token) => onChange?.(token),
        'expired-callback': () => onChange?.(null),
        'error-callback': () => onChange?.(null),
      });
    });
    return () => { cancelled = true; };
  }, [siteKey, onChange]);

  if (!siteKey) return null;
  return <div className="captcha-slot"><div ref={hostRef} /></div>;
}
