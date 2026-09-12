import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:4000/api';

function PolicyList({ currentUser }) {
  const [policies, setPolicies] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCompliance = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/compliance/${currentUser.id}`, {
      headers: {
        'x-user-id': currentUser.id,
        'x-user-role': currentUser.role
      }
    })
      .then(res => res.json())
      .then(data => {
        setPolicies(data.policies);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load policies. Is the backend running?');
        setLoading(false);
      });
  }, [currentUser.id, currentUser.role]);

  useEffect(() => {
    fetchCompliance();
  }, [fetchCompliance]);

  function handleAcknowledge(policyId) {
    fetch(`${API_BASE}/policies/acknowledge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser.id,
        'x-user-role': currentUser.role
      },
      body: JSON.stringify({ policy_id: policyId })
    })
      .then(res => res.json())
      .then(() => fetchCompliance());
  }

  if (loading) return <p>Loading policies…</p>;
  if (error) return <p style={{ color: '#ff4f9a' }}>{error}</p>;

  return (
    <div>
      {policies.map(policy => {
        const isOpen = expandedId === policy.policyId;
        return (
          <div className="policy-card" key={policy.policyId}>
            <div
              className="policy-card-header"
              onClick={() => setExpandedId(isOpen ? null : policy.policyId)}
            >
              <div>
                <div className="policy-title-row">
                  <strong>{policy.title}</strong>
                  <span className="badge badge-mandatory">MANDATORY</span>
                </div>
                <div className="policy-meta">Version {policy.currentVersion}</div>
              </div>
              <span className={`badge ${policy.compliant ? 'badge-done' : 'badge-pending'}`}>
                {policy.compliant ? 'ACKNOWLEDGED' : 'PENDING'}
              </span>
            </div>

            {isOpen && (
              <div className="policy-body">
                {policy.content || 'Policy content goes here.'}
                {!policy.compliant && (
                  <div>
                    <button className="btn-primary" onClick={() => handleAcknowledge(policy.policyId)}>
                      I have read and understood this
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PolicyList;