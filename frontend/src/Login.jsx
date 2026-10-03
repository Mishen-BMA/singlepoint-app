import { useState } from 'react';
import { api } from './api';
import PrivacyNoticeModal from './PrivacyNoticeModal';

function Login({ onLogin, theme, onToggleTheme }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('/auth/login', {
        method: 'POST',
        auth: false,
        body: { email, password }
      });
      onLogin(result.user);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand-mark">S</div>
        <p className="eyebrow">SALLELANKA SOLUTIONS</p>
        <h1>SinglePoint</h1>
        <p className="subtitle">Security policy and compliance</p>
        <button className="theme-toggle login-theme-toggle" type="button" aria-pressed={theme === 'light'} onClick={onToggleTheme}>Switch to {theme === 'dark' ? 'light' : 'dark'} mode</button>
        <button className="privacy-open-button" type="button" onClick={() => setPrivacyOpen(true)}>Privacy notice</button>
        <form className="stack-form" onSubmit={submit}>
          <label>Email<input autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <p className="error-message" role="alert">{error}</p>}
          <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        </form>
      </section>
      {privacyOpen && <PrivacyNoticeModal onClose={() => setPrivacyOpen(false)} />}
    </main>
  );
}

export default Login;