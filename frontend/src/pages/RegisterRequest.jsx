import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import UserNav from '../components/UserNav.jsx';
import Captcha from '../components/Captcha.jsx';
import { api } from '../api';

const blank = {
  email: '', mobile: '', full_name: '', designation: '', company_name: '', company_gst: '',
};

export default function RegisterRequest() {
  const [form, setForm] = useState(blank);
  const [captcha, setCaptcha] = useState({ token: '', answer: '' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pending, setPending] = useState(false);
  const captchaRef = useRef(null);

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const onCaptchaChange = useCallback((c) => setCaptcha(c), []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!captcha.answer) return setError('Please solve the captcha.');
    setPending(true);
    try {
      await api.post('/api/register-request', {
        ...form,
        captcha_token: captcha.token,
        captcha_answer: captcha.answer,
      });
      setSuccess('Thanks — we received your request and will be in touch soon.');
      setForm(blank);
      captchaRef.current?.refresh();
    } catch (err) {
      const details = err.data?.details || [];
      const msg = details.includes('captcha_wrong')   ? 'Captcha answer is wrong — try again.'
                : details.includes('captcha_expired') ? 'Captcha expired — refreshed for you.'
                : details.includes('captcha_missing') || details.includes('captcha_invalid')
                    ? 'Captcha check failed — try again.'
                : details.join(', ') || 'Submission failed. Please try again.';
      setError(msg);
      captchaRef.current?.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <UserNav />
      <main className="container narrow">
        <h1 className="page-title">Register request</h1>
        <p className="page-sub">Tell us about your business — our team will get back to you within one business day.</p>

        {error && <div className="notice error">{error}</div>}
        {success && <div className="notice success">{success}</div>}

        <form onSubmit={onSubmit} className="card">
          <label>Email <span className="req">*</span>
            <input type="email" value={form.email} onChange={onChange('email')} placeholder="you@company.com" required />
          </label>
          <label>Mobile number <span className="req">*</span>
            <input type="tel" value={form.mobile} onChange={onChange('mobile')} placeholder="+91 90000 00000" required />
          </label>
          <label>Full name
            <input type="text" value={form.full_name} onChange={onChange('full_name')} />
          </label>
          <label>Designation
            <input type="text" value={form.designation} onChange={onChange('designation')} />
          </label>
          <label>Company name
            <input type="text" value={form.company_name} onChange={onChange('company_name')} />
          </label>
          <label>Company GST
            <input type="text" value={form.company_gst} onChange={onChange('company_gst')} />
          </label>

          <label>Verify you're human
            <Captcha ref={captchaRef} onChange={onCaptchaChange} />
          </label>

          <button type="submit" className="btn primary full" disabled={pending}>
            {pending ? <><span className="spin" /> Submitting…</> : 'Submit request'}
          </button>
        </form>

        <p style={{ marginTop: '1rem' }}>
          <Link className="inline-link" to="/">← Back to sign in</Link>
        </p>
      </main>
    </>
  );
}
