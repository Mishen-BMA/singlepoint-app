import PolicyList from './PolicyList';
import AdminPolicyManager from './AdminPolicyManager';
import './App.css';
import { useState } from 'react';

function App() {
  const [role, setRole] = useState('staff');
  const [theme, setTheme] = useState('dark');
  const isAdmin = role === 'admin';

  return (
    <div className={`app-shell theme-${theme}`}>
      <div className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-icon">S</div>
            <div className="brand-text">
              <h2>SinglePoint!</h2>
              <span>SALLELANKA</span>
            </div>
          </div>
          <div className="nav-item active">Policies</div>
          <div className="nav-item">Training</div>
          <div className="nav-item">Incidents</div>
          <div className="demo-role-switcher">
            <span>DEMO ROLE</span>
            <button className={!isAdmin ? 'selected' : ''} onClick={() => setRole('staff')}>Staff</button>
            <button className={isAdmin ? 'selected' : ''} onClick={() => setRole('admin')}>Admin</button>
          </div>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Use light mode' : 'Use dark mode'}
          </button>
        </div>
      </div>
      <div className="main">
        <h1>{isAdmin ? 'Policy Management' : 'Security Policies'}</h1>
        <p className="subtitle">
          {isAdmin ? 'Publish policies, update versions, and review staff acknowledgements.' : 'Read each policy and acknowledge the current version.'}
        </p>
        {isAdmin ? <AdminPolicyManager /> : <PolicyList currentUser={{ id: 5, role: 'staff' }} />}
      </div>
    </div>
  );
}

export default App;