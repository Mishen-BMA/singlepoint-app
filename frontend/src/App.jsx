import './App.css';
import { useEffect, useState } from 'react';
import AdminPolicyManager from './AdminPolicyManager';
import AccountSettings from './AccountSettings';
import AuditLog from './AuditLog';
import AupGate from './AupGate';
import Dashboard from './Dashboard';
import IncidentCenter from './IncidentCenter';
import Login from './Login';
import PolicyList from './PolicyList';
import PrivacyNotice from './PrivacyNotice';
import PrivacyNoticeModal from './PrivacyNoticeModal';
import TrainingCenter from './TrainingCenter';
import UserManager from './UserManager';
import { api, clearToken, getToken } from './api';

function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('dashboard');
  const [theme, setTheme] = useState(() => localStorage.getItem('singlepoint-theme') === 'light' ? 'light' : 'dark');
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  function navigateToScreen(nextScreen, replace = false) {
    setScreen(nextScreen);
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({ singlepointScreen: nextScreen }, '', window.location.href);
  }

  useEffect(() => {
    if (!window.history.state || typeof window.history.state.singlepointScreen !== 'string') {
      const currentState = window.history.state && typeof window.history.state === 'object' ? window.history.state : {};
      window.history.replaceState({ ...currentState, singlepointScreen: 'dashboard' }, '', window.location.href);
    }
    function handleUnauthorized() {
      setUser(null);
      setScreen('dashboard');
    }
    function handleAupRequired() {
      api('/auth/me').then(setUser).catch(() => {});
    }
    window.addEventListener('singlepoint:unauthorized', handleUnauthorized);
    window.addEventListener('singlepoint:aup-required', handleAupRequired);
    function handleHistoryNavigation(event) {
      setScreen(event.state && typeof event.state.singlepointScreen === 'string' ? event.state.singlepointScreen : 'dashboard');
    }
    window.addEventListener('popstate', handleHistoryNavigation);
    if (!getToken()) {
      setCheckingSession(false);
    } else {
      api('/auth/me').then(setUser).catch(() => clearToken()).finally(() => setCheckingSession(false));
    }
    return () => {
      window.removeEventListener('singlepoint:unauthorized', handleUnauthorized);
      window.removeEventListener('singlepoint:aup-required', handleAupRequired);
      window.removeEventListener('popstate', handleHistoryNavigation);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('singlepoint-theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => current === 'dark' ? 'light' : 'dark');
  }

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch (error) { /* Clear the client session even if the API is unavailable. */ }
    clearToken();
    setUser(null);
    setScreen('dashboard');
  }

  function handleAupDeclined() {
    clearToken();
    setUser(null);
    setScreen('dashboard');
    window.location.replace(import.meta.env.VITE_AUP_DECLINE_URL || 'about:blank');
  }

  if (checkingSession) return <main className="login-screen"><p>Checking session...</p></main>;
  if (!user) return <div className={`app-theme theme-${theme}`}><Login theme={theme} onToggleTheme={toggleTheme} onLogin={(loggedInUser) => { setUser(loggedInUser); navigateToScreen('dashboard', true); }} /></div>;
  if (user.aupPending) {
    return (
      <div className={`app-theme theme-${theme}`}>
        <AupGate onResolved={(updatedUser) => setUser(updatedUser)} onDeclined={handleAupDeclined} />
      </div>
    );
  }

  const hasPermission = (permission) => Boolean(user.permissions && user.permissions[permission]);
  const isManagement = hasPermission('compliance.view_overview') || user.role === 'admin' || user.role === 'manager' || user.role === 'ceo';
  const canManagePolicies = hasPermission('policies.manage') || user.role === 'admin';
  const canManageUsers = hasPermission('users.manage') || user.role === 'admin';
  const canViewUsers = hasPermission('users.view_directory') || canManageUsers;
  const canViewAudit = hasPermission('audit.view');
  const navigation = [
    { id: 'dashboard', label: isManagement ? 'Compliance overview' : 'My compliance' },
    { id: 'policies', label: 'Security policies' },
    { id: 'training', label: 'Security training' },
    { id: 'incidents', label: isManagement ? 'Incident reports' : 'Report an incident' },
    { id: 'account', label: 'Account security' },
    { id: 'privacy', label: 'Privacy notice' },
    ...(canViewAudit ? [{ id: 'audit', label: 'Audit log' }] : []),
    ...(canViewUsers ? [{ id: 'users', label: canManageUsers ? 'User management' : 'User register' }] : [])
  ];
  const headings = {
    dashboard: isManagement ? 'Compliance overview' : 'My compliance',
    policies: canManagePolicies ? 'Policy management' : 'Security policies',
    training: 'Security training',
    incidents: isManagement ? 'Incident reports' : 'Incident reporting',
    users: 'User management',
    account: 'Account security',
    privacy: 'Privacy notice',
    audit: 'Audit log'
  };

  let content;
  if (screen === 'dashboard') content = <Dashboard user={user} />;
  else if (screen === 'policies' && canManagePolicies) content = <AdminPolicyManager user={user} />;
  else if (screen === 'policies') content = <PolicyList user={user} />;
  else if (screen === 'training') content = <TrainingCenter user={user} />;
  else if (screen === 'incidents') content = <IncidentCenter user={user} />;
  else if (screen === 'users' && canViewUsers) content = <UserManager canManage={canManageUsers} />;
  else if (screen === 'account') content = <AccountSettings onSessionEnded={() => { setUser(null); setScreen('dashboard'); }} />;
  else if (screen === 'privacy') content = <PrivacyNotice />;
  else if (screen === 'audit' && canViewAudit) content = <AuditLog />;
  else content = <Dashboard user={user} />;

  return (
    <div className={`app-theme theme-${theme}`}>
      <div className="app-shell">
        <div className="sidebar">
          <div>
            <div className="brand">
              <div className="brand-icon">S</div>
              <div className="brand-text"><h2>SinglePoint!</h2><span>SALLELANKA</span></div>
            </div>
            <nav aria-label="Main navigation">
              {navigation.map((item) => <button key={item.id} className={`nav-item ${screen === item.id ? 'active' : ''}`} onClick={() => navigateToScreen(item.id)}>{item.label}</button>)}
            </nav>
          </div>
          <div className="sidebar-account">
            <div className="account-name"><strong>{user.name}</strong><span>{user.role}</span></div>
            <button className="theme-toggle" type="button" aria-pressed={theme === 'light'} onClick={toggleTheme}>Switch to {theme === 'dark' ? 'light' : 'dark'} mode</button>
            <button className="btn-secondary" onClick={logout}>Sign out</button>
          </div>
        </div>
        <div className="main">
          <header className="page-header"><div><p className="subtitle">SinglePoint / {user.name}</p><h1>{headings[screen]}</h1></div></header>
          {content}
        </div>
      </div>
      {privacyOpen && <PrivacyNoticeModal onClose={() => setPrivacyOpen(false)} />}
    </div>
  );
}

export default App;