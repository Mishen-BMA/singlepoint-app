import { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:4000/api';
const ADMIN_HEADERS = {
  'x-user-id': '1',
  'x-user-role': 'admin'
};

function AdminPolicyManager() {
  const [policies, setPolicies] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [acknowledgements, setAcknowledgements] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadPolicies();
  }, []);

  async function loadPolicies() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/policies`, { headers: ADMIN_HEADERS });
      if (!response.ok) throw new Error('Could not load policies');
      setPolicies(await response.json());
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
  }

  function editPolicy(policy) {
    setEditingId(policy.id);
    setTitle(policy.title);
    setContent(policy.content);
    setMessage('');
  }

  async function savePolicy(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    const endpoint = editingId ? `${API_BASE}/policies/${editingId}` : `${API_BASE}/policies`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { ...ADMIN_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save policy');
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
      const response = await fetch(`${API_BASE}/policies/${policyId}/acknowledgements`, {
        headers: ADMIN_HEADERS
      });
      if (!response.ok) throw new Error('Could not load acknowledgements');
      const data = await response.json();
      setAcknowledgements((current) => ({ ...current, [policyId]: data }));
    } catch (acknowledgementError) {
      setError(acknowledgementError.message);
    }
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
        <form onSubmit={savePolicy} className="policy-form">
          <label>
            Policy title
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label>
            Policy content
            <textarea value={content} onChange={(event) => setContent(event.target.value)} rows="8" required />
          </label>
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
                <button className="btn-secondary" onClick={() => editPolicy(policy)}>Edit</button>
              </div>
              <p className="policy-preview">{policy.content}</p>
              <button className="link-button" onClick={() => viewAcknowledgements(policy.id)}>
                View acknowledgement record
              </button>
              {acknowledgements[policy.id] && (
                <div className="acknowledgement-list">
                  <strong>{acknowledgements[policy.id].length} acknowledgement(s)</strong>
                  {acknowledgements[policy.id].map((acknowledgement) => (
                    <span key={acknowledgement.id}>
                      User {acknowledgement.user_id} · version {acknowledgement.version_acknowledged} · {new Date(acknowledgement.acknowledged_at).toLocaleString()}
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
