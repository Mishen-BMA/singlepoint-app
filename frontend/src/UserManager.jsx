import { useEffect, useState } from 'react';
import { api } from './api';
import PasswordInput from './PasswordInput';

const ROLE_OPTIONS = [
  ['admin', 'System Administrator'],
  ['ceo', 'CEO'],
  ['manager', 'Manager'],
  ['software_engineer', 'Software Engineer'],
  ['hr', 'HR'],
  ['data_science', 'Data Analyst / Data Science']
];

const roleLabel = Object.fromEntries(ROLE_OPTIONS);

function UserManager({ canManage = true }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'software_engineer' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() { setUsers(await api('/users')); }
  useEffect(() => { load().catch((loadError) => setError(loadError.message)); }, []);

  async function changeRole(userId, role) {
    setError('');
    try {
      await api(`/users/${userId}/role`, { method: 'PATCH', body: { role } });
      await load();
    } catch (updateError) { setError(updateError.message); }
  }

  async function changeStatus(account) {
    setError('');
    try {
      await api(`/users/${account.id}/active`, { method: 'PATCH', body: { isActive: !account.is_active } });
      await load();
    } catch (updateError) { setError(updateError.message); }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      await api('/users', { method: 'POST', body: form });
      setForm({ name: '', email: '', password: '', role: 'software_engineer' });
      setNotice('Account created. Share its initial password securely.');
      await load();
    } catch (createError) { setError(createError.message); }
  }

  return (
    <div className="page-stack user-layout">
      {canManage && <section className="data-section">
        <span className="eyebrow">ADMINISTRATION</span><h2>Create staff account</h2>
        <form className="stack-form" onSubmit={submit}>
          <label>Full name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
          <label>Temporary password<PasswordInput minLength="12" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></label>
          <label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button className="btn-primary" type="submit">Create account</button>
        </form>
        {notice && <p className="success-message" role="status">{notice}</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>}
      <section className="data-section">
        <div className="section-heading"><div><span className="eyebrow">ACCESS REGISTER</span><h2>Accounts</h2></div><span>{users.length} users</span></div>
        <div className="user-list">{users.map((account) => <div className={`user-row ${account.is_active ? '' : 'user-row-inactive'}`} key={account.id}><div><strong>{account.name}</strong><small>{account.email} · {roleLabel[account.role] || account.role} · {account.is_active ? 'Active' : 'Inactive'}</small></div>{canManage && <><label className="sr-only" htmlFor={`role-${account.id}`}>Role for {account.name}</label><select id={`role-${account.id}`} value={account.role} onChange={(event) => changeRole(account.id, event.target.value)}>{ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="btn-secondary" onClick={() => changeStatus(account)}>{account.is_active ? 'Deactivate' : 'Reactivate'}</button></>}</div>)}</div>
      </section>
    </div>
  );
}

export default UserManager;