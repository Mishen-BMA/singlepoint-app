import { useEffect, useState } from 'react';
import { api } from './api';
import { renderPolicyContent } from './AupGate';

function PolicyList() {
  const [policies, setPolicies] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadPolicies() {
    setLoading(true);
    setError('');
    try { setPolicies(await api('/policies')); }
    catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadPolicies(); }, []);

  async function handleAcknowledge(policyId) {
    try {
      await api('/policies/acknowledge', { method: 'POST', body: { policy_id: policyId } });
      await loadPolicies();
    } catch (acknowledgeError) { setError(acknowledgeError.message); }
  }

  if (loading) return <p>Loading policies...</p>;
  if (error) return <p className="error-message" role="alert">{error}</p>;

  return (
    <div className="policy-list">
      {policies.map((policy) => {
        const isOpen = expandedId === policy.id;
        const badgeLabel = policy.status === 'declined' ? 'DECLINED' : policy.compliant ? 'ACKNOWLEDGED' : policy.overdue ? 'OVERDUE' : 'PENDING';
        const badgeClass = policy.status === 'declined' ? 'badge-overdue' : policy.compliant ? 'badge-done' : policy.overdue ? 'badge-overdue' : 'badge-pending';
        return (
          <article className="policy-card" key={policy.id}>
            <button className="policy-card-header" aria-expanded={isOpen} onClick={() => setExpandedId(isOpen ? null : policy.id)}>
              <div>
                <div className="policy-title-row"><strong>{policy.title}</strong><span className="badge badge-mandatory">MANDATORY</span></div>
                <div className="policy-meta">Version {policy.version} | {policy.requires_gate ? 'Required at sign-in' : 'Assigned policy'}</div>
              </div>
              <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
            </button>
            {isOpen && <div className="policy-body">
              <div className="policy-reading-panel">{renderPolicyContent(policy.content)}</div>
              {!policy.compliant && !policy.requires_gate && <div><button className="btn-primary" onClick={() => handleAcknowledge(policy.id)}>I have read and understood this</button></div>}
              {policy.requires_gate && !policy.compliant && <p className="policy-meta">This policy is enforced at sign-in; use the Acceptable Use Policy prompt shown after login to respond.</p>}
              {policy.acknowledged_at && <small className="policy-meta">{policy.status === 'declined' ? 'Declined' : 'Acknowledged'} {new Date(policy.acknowledged_at).toLocaleString()}</small>}
            </div>}
          </article>
        );
      })}
      {policies.length === 0 && <p>No policies have been published yet.</p>}
    </div>
  );
}

export default PolicyList;