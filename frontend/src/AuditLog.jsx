import { useEffect, useState } from 'react';
import { api } from './api';

function AuditLog() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api('/auth/events')
      .then((result) => { if (active) setEvents(result); })
      .catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, []);

  if (error) return <p className="error-message" role="alert">{error}</p>;
  if (events === null) return <p>Loading audit log...</p>;

  return (
    <section className="data-section audit-log-page">
      <span className="eyebrow">ACCOUNT ACTIVITY</span>
      <h2>Sign-in events</h2>
      {events.length === 0 ? <p>No sign-in events recorded.</p> : <div className="table-scroll"><table>
        <thead><tr><th>Account</th><th>Event</th><th>Time</th><th>IP address</th></tr></thead>
        <tbody>{events.map((event) => <tr key={event.id}><td>{event.user_name || 'Unmatched account'}</td><td>{event.action.replaceAll('_', ' ')}</td><td>{new Date(event.occurred_at).toLocaleString()}</td><td>{event.ip_address || '-'}</td></tr>)}</tbody>
      </table></div>}
    </section>
  );
}

export default AuditLog;