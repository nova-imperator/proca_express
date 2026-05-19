import { useState } from 'react';

/**
 * Password input with a show/hide eye toggle on the right edge.
 *
 * Drop-in replacement for `<input type="password" />` — accepts all the same
 * props (value, onChange, required, minLength, autoComplete, placeholder, …)
 * and forwards them to the underlying input.
 */
export default function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-input">
      <input {...props} type={show ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-10-7-10-7a18.5 18.5 0 0 1 4.06-5.36" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 7 10 7a18.45 18.45 0 0 1-3.17 4.18" />
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
