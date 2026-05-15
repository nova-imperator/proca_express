import { useState } from 'react';
import { Link } from 'react-router-dom';
import UserNav from '../components/UserNav.jsx';
import { api } from '../api';

const blank = {
  email: '', mobile: '', full_name: '', designation: '', company_name: '', company_gst: '',
};

export default function RegisterRequest() {
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pending, setPending] = useState(false);

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null); setSuccess(null); setPending(true);
    try {
      await api.post('/api/register-request', form);
      setSuccess('Thanks — we received your request and will be in touch soon.');
      setForm(blank);
    } catch (err) {
      setError(err.data?.details?.join(', ') || 'Submission failed. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <UserNav />
      <main className="container narrow">
        <h1>Register request</h1>
        <p className="muted">Tell us about your business — our team will get back to you.</p>

        {error && <div className="notice error">{error}</div>}
        {success && <div className="notice success">{success}</div>}

        <form onSubmit={onSubmit} className="card">
          <label>Email <span className="req">*</span>
            <input type="email" value={form.email} onChange={onChange('email')} required />
          </label>
          <label>Mobile number <span className="req">*</span>
            <input type="tel" value={form.mobile} onChange={onChange('mobile')} required />
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
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? 'Submitting…' : 'Submit request'}
          </button>
        </form>

        <p><Link to="/">Back to sign in</Link></p>
      </main>
    </>
  );
}
