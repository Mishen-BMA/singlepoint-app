import { useEffect, useRef, useState } from 'react';
import { api } from './api';

function Dashboard({ user }) {
  const isManager = user.role === 'admin' || user.role === 'manager' || Boolean(user.permissions && user.permissions['compliance.view_overview']);
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [personal, setPersonal] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [popupReminder, setPopupReminder] = useState(null);
  const [reminders, setReminders] = useState([]);
  const shownReminderIds = useRef(new Set());

  useEffect(() => {
    let active = true;
    function receiveReminders(nextReminders) {
      if (!active) return;
      setReminders(nextReminders);
      const nextPopup = nextReminders.find((reminder) => !reminder.read_at && !shownReminderIds.current.has(reminder.id));
      if (nextPopup) {
        shownReminderIds.current.add(nextPopup.id);
        setPopupReminder(nextPopup);
      }
    }
    async function load() {
      try {
        const remindersPromise = api('/compliance/reminders/me');
        if (isManager) {
          const [summary, history, incidentData, currentReminders] = await Promise.all([
            api('/compliance/overview'), api('/compliance/trends'), api('/incidents'), remindersPromise
          ]);
          if (active) {
            setOverview(summary);
            setTrends(history);
            setRecentIncidents(incidentData.incidents.slice(0, 3));
            receiveReminders(currentReminders);
          }
        } else {
          const [policies, training, incidents, currentReminders, survey] = await Promise.all([
            api('/policies'), api('/training/progress/me'), api('/incidents'), remindersPromise, api('/training/survey')
          ]);
          if (active) {
            setPersonal({ policies, training, incidents: incidents.incidents, reminders: currentReminders, survey });
            receiveReminders(currentReminders);
          }
        }
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    }
    load();
    const poller = window.setInterval(() => {
      api('/compliance/reminders/me').then(receiveReminders).catch(() => {});
    }, 15000);
    return () => { active = false; window.clearInterval(poller); };
  }, [isManager]);

  async function acknowledgeReminder() {
    if (!popupReminder) return;
    const reminder = popupReminder;
    try {
      const acknowledged = await api(`/compliance/reminders/${reminder.id}/read`, { method: 'PATCH' });
      const updatedReminders = reminders.map((item) => item.id === reminder.id ? { ...item, read_at: acknowledged.read_at } : item);
      setReminders(updatedReminders);
      const nextPopup = updatedReminders.find((item) => !item.read_at && !shownReminderIds.current.has(item.id));
      if (nextPopup) shownReminderIds.current.add(nextPopup.id);
      setPopupReminder(nextPopup || null);
    } catch (acknowledgeError) {
      setError(acknowledgeError.message);
    }
  }

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

  const reminderPopup = popupReminder && (
    <div className="privacy-modal-backdrop reminder-popup-backdrop" role="presentation">
      <section className="privacy-modal reminder-popup" role="dialog" aria-modal="true" aria-labelledby="reminder-title">
        <div className="privacy-modal-header"><h2 id="reminder-title">Compliance reminder</h2></div>
        <p>{popupReminder.message}</p>
        <button className="btn-primary" type="button" onClick={acknowledgeReminder}>Acknowledge</button>
      </section>
    </div>
  );

  if (isManager) {
    if (!overview) return <p>Loading compliance overview...</p>;
    return (
      <>
      {reminderPopup}
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
      </>
    );
  }

  if (!personal) return <p>Loading your compliance...</p>;
  const acknowledged = personal.policies.filter((policy) => policy.compliant).length;
  const requiredTraining = personal.training.filter((module) => module.recommended);
  const completedTraining = requiredTraining.filter((module) => module.completed).length;
  const completed = completedTraining + Number(personal.survey.complete);
  const totalTraining = requiredTraining.length + 1;
  return (
    <>
    {reminderPopup}
    <div className="page-stack">
      <div className="section-heading"><div><span className="eyebrow">YOUR STATUS</span><h2>My compliance</h2></div></div>
      <div className="metric-grid">
        <Metric label="Policies acknowledged" value={`${acknowledged}/${personal.policies.length}`} />
        <Metric label="Training requirements" value={`${completed}/${totalTraining}`} />
        <Metric label="Incidents reported" value={personal.incidents.length} />
      </div>
      <section className="data-section">
        <h2>Pending actions</h2>
        {reminders.length === 0 && acknowledged === personal.policies.length && completed === totalTraining
          ? <p>You are up to date.</p>
          : <ul className="action-list">
            {personal.policies.filter((policy) => !policy.compliant).map((policy) => <li className={policy.overdue ? 'status-overdue' : ''} key={`p-${policy.id}`}>{policy.overdue ? 'Overdue: ' : 'Acknowledge: '}{policy.title}</li>)}
            {!personal.survey.complete && <li key="survey">Complete the security habits survey</li>}
            {requiredTraining.filter((module) => !module.completed).map((module) => <li className={module.overdue ? 'status-overdue' : ''} key={`t-${module.module_id}`}>{module.overdue ? 'Overdue: ' : 'Complete: '}{module.title}</li>)}
            {reminders.map((reminder) => <li key={`r-${reminder.id}`}>Manager reminder: {reminder.message}</li>)}
          </ul>}
      </section>
    </div>
    </>
  );
}

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

export default Dashboard;