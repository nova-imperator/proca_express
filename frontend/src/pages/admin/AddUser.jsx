import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminNav from '../../components/AdminNav.jsx';
import { api } from '../../api';

const blank = {
  email: '', mobile: '', password: '', confirm: '',
  full_name: '', designation: '', company_name: '', company_gst: '',
};

export default function AddUser() {
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const nav = useNavigate();

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) return setError('Passwords must match.');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    setPending(true);
    try {
      // eslint-disable-next-line no-unused-vars
      const { confirm, ...payload } = form;
      await api.post('/api/admin/users', payload);
      nav('/admin/users');
    } catch (err) {
      const code = err.data?.error;
      setError(
        code === 'duplicate_email_or_mobile'
          ? 'A user with that email or mobile already exists.'
          : code === 'missing_fields'
          ? 'Email, mobile, and password are required.'
          : 'Failed to create user.'
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <AdminNav />
      <main className="container narrow">
        <h1>Add user</h1>
        {error && <div className="notice error">{error}</div>}
        <form onSubmit={onSubmit} className="card">
          <label>Email <span className="req">*</span>
            <input type="email" value={form.email} onChange={onChange('email')} required />
          </label>
          <label>Mobile <span className="req">*</span>
            <input type="tel" value={form.mobile} onChange={onChange('mobile')} required />
          </label>
          <label>Password <span className="req">*</span>
            <input type="password" value={form.password} onChange={onChange('password')} required minLength={8} />
          </label>
          <label>Confirm password <span className="req">*</span>
            <input type="password" value={form.confirm} onChange={onChange('confirm')} required minLength={8} />
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
          <div className="row">
            <button className="btn primary" type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create user'}
            </button>
            <Link className="btn" to="/admin/users">Cancel</Link>
          </div>
        </form>
      </main>
    </>
  );
}
