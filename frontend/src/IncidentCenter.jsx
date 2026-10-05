import { useEffect, useState } from 'react';
import { api } from './api';

const INCIDENT_TYPES = ['Suspicious Client Request', 'Lost Device', 'Policy Violation', 'Suspicious Activity', 'Other'];
const STATUSES = ['Open', 'Investigating', 'Resolved'];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

function IncidentCenter({ user }) {
  const canReview = Boolean(user.permissions && user.permissions['incidents.triage']);
  const canSubmit = Boolean(user.permissions && user.permissions['incidents.submit']);
  const [incidents, setIncidents] = useState([]);
  const [incidentType, setIncidentType] = useState(INCIDENT_TYPES[0]);
  const [severity, setSeverity] = useState('Medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    const result = await api('/incidents');
    setIncidents(result.incidents);
  }

  useEffect(() => { load().catch((loadError) => setError(loadError.message)); }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/incidents', { method: 'POST', body: { incident_type: incidentType, title, description, severity } });
      setTitle('');
      setDescription('');
      setNotice('Incident report submitted.');
      await load();
    } catch (submitError) { setError(submitError.message); }
  }

  async function updateStatus(id, status) {
    try {
      await api(`/incidents/${id}`, { method: 'PATCH', body: { status } });
      await load();
    } catch (updateError) { setError(updateError.message); }
  }

  return (
    <div className="page-stack">
      {canSubmit && <section className="data-section">
        <span className="eyebrow">REPORT A CONCERN</span><h2>New incident report</h2>
        <form className="stack-form" onSubmit={submit}>
          <label>Incident type<select value={incidentType} onChange={(event) => setIncidentType(event.target.value)}>{INCIDENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value)}>{SEVERITIES.map((level) => <option key={level}>{level}</option>)}</select></label>
          <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} minLength="3" maxLength="255" required /></label>
          <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength="10" rows="5" required /></label>
          <button className="btn-primary" type="submit">Submit report</button>
        </form>
      </section>}
      {notice && <p className="success-message" role="status">{notice}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <section className="data-section">
        <div className="section-heading"><div><span className="eyebrow">{canReview ? 'MANAGEMENT' : 'YOUR REPORTS'}</span><h2>{canReview ? 'Incident reports' : 'My incident reports'}</h2></div><span>{incidents.length} reports</span></div>
        <div className="incident-list">
          {incidents.map((incident) => (
            <article className="incident-row" key={incident.id}>
              <div><span className={`status-chip status-${incident.status.toLowerCase()}`}>{incident.status}</span><span className={`severity-label severity-${incident.severity.toLowerCase()}`}>{incident.severity}</span><h3>{incident.title}</h3><p>{incident.description}</p><small>{incident.incident_type} · {incident.reported_by_name || 'Reported by you'} · {new Date(incident.reported_at).toLocaleString()}</small></div>
              {canReview && <label className="status-control">Status<select value={incident.status} onChange={(event) => updateStatus(incident.id, event.target.value)}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>}
            </article>
          ))}
          {incidents.length === 0 && <p>No incident reports yet.</p>}
        </div>
      </section>
    </div>
  );
}

export default IncidentCenter;