import { useState } from 'react';
import { api, clearToken } from './api';
import PasswordInput from './PasswordInput';

function AccountSettings({ onSessionEnded }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [changed, setChanged] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmation) {
      setError('The new passwords do not match.');
      return;
    }
    try {
      await api('/auth/password', { method: 'PATCH', body: { currentPassword, newPassword } });
      clearToken();
      setChanged(true);
    } catch (changeError) {
      setError(changeError.message);
    }
  }

  if (changed) {
    return <section className="data-section"><h2>Password updated</h2><p>Your other sessions have been signed out. Sign in again with your new password.</p><button className="btn-primary" onClick={onSessionEnded}>Continue to sign in</button></section>;
  }

  return (
    <section className="data-section account-settings">
      <span className="eyebrow">ACCOUNT SECURITY</span>
      <h2>Change password</h2>
      <form className="stack-form" onSubmit={submit}>
        <label>Current password<PasswordInput autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
        <label>New password<PasswordInput autoComplete="new-password" minLength="12" maxLength="72" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
        <label>Confirm new password<PasswordInput autoComplete="new-password" value={confirmation} minLength="12" maxLength="72" onChange={(event) => setConfirmation(event.target.value)} required /></label>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="btn-primary" type="submit">Update password</button>
      </form>
    </section>
  );
}

export default AccountSettings;