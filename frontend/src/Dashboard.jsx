import { useEffect, useState } from 'react';
import { api } from './api';

function Dashboard({ user }) {
  const isManager = user.role === 'admin' || user.role === 'manager';
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [personal, setPersonal] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (isManager) {
          const [summary, history, incidentData] = await Promise.all([
            api('/compliance/overview'),
            api('/compliance/trends'),
            api('/incidents')
          ]);
          if (active) {
            setOverview(summary);
            setTrends(history);
            setRecentIncidents(incidentData.incidents.slice(0, 3));
          }
        } else {
          const [policies, training, incidents, reminders, survey] = await Promise.all([
            api('/policies'),
            api('/training/progress/me'),
            api('/incidents'),
            api('/compliance/reminders/me'),
            api('/training/survey')
          ]);
          if (active) setPersonal({ policies, training, incidents: incidents.incidents, reminders, survey });
        }
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    }
    load();
    return () => { active = false; };
  }, [isManager]);

  async function remind(userId) {
    setNotice('');
    try {
      await api('/compliance/reminders', {
        method: 'POST',
        body: { userId, message: 'Please review your pending policies and recommended training.' }
      });
      setNotice('Reminder added to the staff member inbox.');
    } catch (reminderError) {
      setError(reminderError.message);
    }
  }

  async function downloadReport() {
    try {
      const blob = await api('/compliance/export.csv', { responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'singlepoint-compliance.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError.message);
    }
  }

  if (error) return <p className="error-message" role="alert">{error}</p>;

  if (isManager) {
    if (!overview) return <p>Loading compliance overview...</p>;
    return (
      <div className="page-stack">
        <div className="section-heading">
          <div><span className="eyebrow">TEAM STATUS</span><h2>Compliance overview</h2></div>
          <button className="btn-secondary" onClick={downloadReport}>Export CSV</button>
        </div>
        {notice && <p className="success-message" role="status">{notice}</p>}
        <div className="metric-grid">
          <Metric label="Company compliance" value={`${overview.compliancePercentage}%`} />
          <Metric label="Compliant staff" value={`${overview.compliantCount}/${overview.staffCount}`} />
          <Metric label="Pending actions" value={overview.pendingCount} />
          <Metric label="Overdue items" value={overview.overdueCount} />
        </div>
        <section className="data-section">
          <h2>Staff compliance</h2>
          <div className="table-scroll"><table>
            <thead><tr><th>Staff member</th><th>Role</th><th>Policies</th><th>Training</th><th>Overdue</th><th>Compliance</th><th>Actions</th></tr></thead>
            <tbody>{overview.staff.map((member) => (
              <tr key={member.id}>
                <td><strong>{member.name}</strong><small>{member.email}</small></td>
                <td>{member.role}</td>
                <td>{member.acknowledgedPolicies}/{member.totalPolicies}</td>
                <td>{member.completedTraining}/{member.totalTraining}</td>
                <td className={member.overdueItems ? 'status-overdue' : ''}>{member.overdueItems || '-'}</td>
                <td><span className={member.pendingItems ? 'status-pending' : 'status-done'}>{member.compliancePercentage}%</span></td>
                <td>{member.pendingItems > 0 && <button className="link-button" onClick={() => remind(member.id)}>Send reminder</button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
        <section className="data-section">
          <h2>Recent incident reports</h2>
          {recentIncidents.length === 0 ? <p>No reports have been submitted.</p> : (
            <div className="incident-list">{recentIncidents.map((incident) => (
              <article className="incident-row" key={incident.id}>
                <div><span className="status-chip">{incident.status}</span><h3>{incident.title}</h3><small>{incident.reported_by_name} · {new Date(incident.reported_at).toLocaleString()}</small></div>
              </article>
            ))}</div>
          )}
        </section>
        <section className="data-section">
          <h2>Compliance history</h2>
          {trends.length === 0 ? <p>No history recorded yet.</p> : (
            <div className="trend-list">{trends.map((point) => (
              <div className="trend-row" key={point.snapshot_date}>
                <span>{new Date(point.snapshot_date).toLocaleDateString()}</span>
                <div className="trend-track"><span style={{ width: `${point.compliance_percentage}%` }} /></div>
                <strong>{Math.round(point.compliance_percentage)}%</strong>
              </div>
            ))}</div>
          )}
        </section>
      </div>
    );
  }

  if (!personal) return <p>Loading your compliance...</p>;
  const acknowledged = personal.policies.filter((policy) => policy.compliant).length;
  const requiredTraining = personal.training.filter((module) => module.recommended);
  const completedTraining = requiredTraining.filter((module) => module.completed).length;
  const completed = completedTraining + Number(personal.survey.complete);
  const totalTraining = requiredTraining.length + 1;
  return (
    <div className="page-stack">
      <div className="section-heading"><div><span className="eyebrow">YOUR STATUS</span><h2>My compliance</h2></div></div>
      <div className="metric-grid">
        <Metric label="Policies acknowledged" value={`${acknowledged}/${personal.policies.length}`} />
        <Metric label="Training requirements" value={`${completed}/${totalTraining}`} />
        <Metric label="Incidents reported" value={personal.incidents.length} />
      </div>
      <section className="data-section">
        <h2>Pending actions</h2>
        {personal.reminders.length === 0 && acknowledged === personal.policies.length && completed === totalTraining
          ? <p>You are up to date.</p>
          : <ul className="action-list">
            {personal.policies.filter((policy) => !policy.compliant).map((policy) => <li className={policy.overdue ? 'status-overdue' : ''} key={`p-${policy.id}`}>{policy.overdue ? 'Overdue: ' : 'Acknowledge: '}{policy.title}</li>)}
            {!personal.survey.complete && <li key="survey">Complete the security habits survey</li>}
            {requiredTraining.filter((module) => !module.completed).map((module) => <li className={module.overdue ? 'status-overdue' : ''} key={`t-${module.module_id}`}>{module.overdue ? 'Overdue: ' : 'Complete: '}{module.title}</li>)}
            {personal.reminders.map((reminder) => <li key={`r-${reminder.id}`}>Manager reminder: {reminder.message}</li>)}
          </ul>}
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

export default Dashboard;