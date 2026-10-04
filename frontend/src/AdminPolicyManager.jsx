import { useEffect, useState } from 'react';
import { api } from './api';

const POLICY_ROLES = [
  ['ceo', 'CEO'],
  ['manager', 'Manager'],
  ['software_engineer', 'Software Engineer'],
  ['hr', 'HR'],
  ['data_science', 'Data Analyst / Data Science']
];

function AdminPolicyManager() {
  const [policies, setPolicies] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetRoles, setTargetRoles] = useState(POLICY_ROLES.map(([role]) => role));
  const [editingId, setEditingId] = useState(null);
  const [acknowledgements, setAcknowledgements] = useState({});
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  useEffect(() => {
    loadPolicies();
  }, []);

  async function loadPolicies() {
    setLoading(true);
    setError('');
    try {
      setPolicies(await api('/policies'));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setContent('');
    setTargetRoles(POLICY_ROLES.map(([role]) => role));
  }

  function editPolicy(policy) {
    setEditingId(policy.id);
    setTitle(policy.title);
    setContent(policy.content);
    setTargetRoles(policy.targetRoles && policy.targetRoles.length ? policy.targetRoles : POLICY_ROLES.map(([role]) => role));
    setMessage('');
    window.requestAnimationFrame(() => {
      document.getElementById('policy-editor-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('policy-title-input')?.focus();
    });
  }

  async function savePolicy(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    const endpoint = editingId ? `/policies/${editingId}` : '/policies';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const data = await api(endpoint, {
        method,
        body: { title, content, targetRoles }
      });
      setMessage(editingId ? `Policy published as version ${data.version}.` : 'Policy published.');
      resetForm();
      await loadPolicies();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function viewAcknowledgements(policyId) {
    try {
      const data = await api(`/policies/${policyId}/acknowledgements`);
      setAcknowledgements((current) => ({ ...current, [policyId]: data }));
    } catch (acknowledgementError) {
      setError(acknowledgementError.message);
    }
  }

  async function viewHistory(policyId) {
    try {
      const data = await api(`/policies/${policyId}/acknowledgement-history`);
      setHistory((current) => ({ ...current, [policyId]: data }));
    } catch (historyError) {
      setError(historyError.message);
    }
  }

  async function deletePolicy(policy) {
    if (policy.requires_gate) return;
    if (pendingDeleteId !== policy.id) {
      setPendingDeleteId(policy.id);
      setMessage(`Click Delete again to permanently remove "${policy.title}".`);
      return;
    }
    setError('');
    setMessage('');
    try {
      await api(`/policies/${policy.id}`, { method: 'DELETE' });
      setMessage('Policy deleted.');
      setPendingDeleteId(null);
      if (editingId === policy.id) resetForm();
      await loadPolicies();
    } catch (deleteError) {
      setError(deleteError.message);
      setPendingDeleteId(null);
    }
  }

  function statusLabel(status) {
    if (status === 'acknowledged') return 'agreed';
    if (status === 'declined') return 'declined';
    if (status === 'overdue') return 'overdue';
    return 'pending';
  }

  if (loading) return <p>Loading policy management...</p>;

  return (
    <div className="admin-policy-layout">
      <section className="policy-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ADMIN CONTROL</span>
            <h2>{editingId ? 'Update security policy' : 'Publish a security policy'}</h2>
          </div>
          {editingId && <button className="btn-secondary" onClick={resetForm}>Cancel</button>}
        </div>
        <form id="policy-editor-form" onSubmit={savePolicy} className="policy-form">
          <label>
            Policy title
            <input id="policy-title-input" value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label>
            Policy content
            <textarea value={content} onChange={(event) => setContent(event.target.value)} rows="8" required />
          </label>
          <fieldset className="target-roles"><legend>Visible to roles</legend>{POLICY_ROLES.map(([role, label]) => <label key={role}><input type="checkbox" checked={targetRoles.includes(role)} onChange={(event) => setTargetRoles((current) => event.target.checked ? [...current, role] : current.filter((item) => item !== role))} />{label}</label>)}</fieldset>
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Publish new version' : 'Publish policy'}
          </button>
        </form>
        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}
      </section>

      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">POLICY REGISTER</span>
            <h2>Published policies</h2>
          </div>
          <span className="count-label">{policies.length} policies</span>
        </div>
        <div className="admin-policy-list">
          {policies.map((policy) => (
            <article className="policy-card admin-policy-card" key={policy.id}>
              <div className="policy-card-header">
                <div>
                  <div className="policy-title-row">
                    <strong>{policy.title}</strong>
                    <span className="badge badge-mandatory">ACTIVE</span>
                  </div>
                  <div className="policy-meta">Version {policy.version} · Updated {new Date(policy.updated_at).toLocaleDateString()}</div>
                </div>
                <div className="button-row">
                  <button type="button" className="btn-secondary" onClick={() => editPolicy(policy)}>Edit</button>
                  {!policy.requires_gate && <button type="button" className="btn-danger" onClick={() => deletePolicy(policy)}>{pendingDeleteId === policy.id ? 'Confirm delete' : 'Delete'}</button>}
                </div>
              </div>
              <p className="policy-preview">{policy.content}</p>
              <button className="link-button" onClick={() => viewAcknowledgements(policy.id)}>
                View acknowledgement record
              </button>
              {policy.requires_gate && (
                <button className="link-button" onClick={() => viewHistory(policy.id)}>
                  View full acknowledgement history
                </button>
              )}
              {acknowledgements[policy.id] && (
                <div className="acknowledgement-list">
                    <strong>{acknowledgements[policy.id].filter((entry) => entry.compliant).length}/{acknowledgements[policy.id].length} acknowledged</strong>
                  {acknowledgements[policy.id].map((acknowledgement) => (
                    <span key={acknowledgement.user_id}>
                      {acknowledgement.name} · {acknowledgement.compliant ? `version ${acknowledgement.version_acknowledged} acknowledged` : statusLabel(acknowledgement.status)}
                    </span>
                  ))}
                </div>
              )}
              {history[policy.id] && (
                <div className="acknowledgement-list">
                  <strong>Full history ({history[policy.id].length} events)</strong>
                  {history[policy.id].map((entry) => (
                    <span key={entry.id}>
                      {entry.user_name} · version {entry.version_acknowledged} · {entry.decision} · {new Date(entry.acknowledged_at).toLocaleString()}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AdminPolicyManager;
