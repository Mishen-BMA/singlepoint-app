import PolicyList from './PolicyList';
import './App.css';

function App() {
  return (
    <div className="app-shell">
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
        </div>
      </div>
      <div className="main">
        <h1>Security Policies</h1>
        <p className="subtitle">Read each policy and click "I have read and understood this" to acknowledge.</p>
        <PolicyList />
      </div>
    </div>
  );
}

export default App;