import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from './api';

export function renderPolicyContent(content) {
  let normalizedContent = content.replace(/\r\n?/g, '\n');
  const firstSectionIndex = normalizedContent.search(/\s\d+\.\s+[A-Z]/);
  if (firstSectionIndex >= 0) {
    const prefix = normalizedContent.slice(0, firstSectionIndex);
    const suffix = normalizedContent.slice(firstSectionIndex);
    normalizedContent = `${prefix.replace(/\s-\s/, ' __POLICY_DASH__ ')}${suffix}`;
  }
  const lines = normalizedContent
    .replace(/([^\n])\s+(?=\d+\.\s+[A-Z])/g, '$1\n\n')
    .replace(/([^\n])\s+-\s+(?=[A-Z])/g, '$1\n- ')
    .replace(/__POLICY_DASH__/g, '-')
    .split('\n');
  const elements = [];
  let bullets = [];

  function flushBullets() {
    if (bullets.length === 0) return;
    elements.push(
      <ul key={`bullets-${elements.length}`}>
        {bullets.map((bullet, index) => <li key={`${bullet}-${index}`}>{bullet}</li>)}
      </ul>
    );
    bullets = [];
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      return;
    }

    const markdownHeading = trimmed.match(/^#{1,3}\s+(.+)$/);
    const aupHeading = trimmed.match(
      /^(\d+)\.\s+(Purpose and scope|Accounts and passwords|Roles and access|Remote access and client systems|Client and personal data|Devices and messaging|Policies and training|Incident reporting|Monitoring and privacy|Enforcement and consequences)(?:\s+(.+))?$/i
    );
    const numberedHeading = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (markdownHeading || aupHeading || numberedHeading) {
      flushBullets();
      elements.push(
        <h2 key={`heading-${index}`}>
          {markdownHeading
            ? markdownHeading[1]
            : `${(aupHeading || numberedHeading)[1]}. ${(aupHeading || numberedHeading)[2]}`}
        </h2>
      );
      if (aupHeading && aupHeading[3]) {
        elements.push(<p key={`heading-copy-${index}`}>{aupHeading[3]}</p>);
      }
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }

    flushBullets();
    elements.push(<p key={`paragraph-${index}`}>{trimmed}</p>);
  });

  flushBullets();
  return elements;
}

// A mandatory, full-screen gate shown instead of the rest of the app whenever
// the signed-in user has not agreed to the current version of a gate-flagged
// policy (currently just the Acceptable Use Policy). There is no way to skip
// or close it: Escape and clicking outside do nothing, and the only actions
// are to read, scroll to the end, then Agree or Disagree.
function AupGate({ onResolved, onDeclined }) {
  const [pending, setPending] = useState([]);
  const [index, setIndex] = useState(0);
  const [canAgree, setCanAgree] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const containerRef = useRef(null);
  const scrollRegionRef = useRef(null);

  const currentPolicy = pending[index];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api('/policies/gate');
        if (!cancelled) setPending(data.pending || []);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Reset the "I agree" gate whenever a new policy (or a replaced, newer
  // version of the same policy) is shown. If the text does not overflow the
  // scroll region there is nothing to scroll past, so allow Agree right away.
  // useLayoutEffect (rather than useEffect) so this is applied synchronously
  // as part of the same commit that rendered the scroll region.
  useLayoutEffect(() => {
    setConfirmDecline(false);
    const region = scrollRegionRef.current;
    if (region && region.scrollHeight <= region.clientHeight + 1) {
      setCanAgree(true);
    } else {
      setCanAgree(false);
    }
  }, [index, currentPolicy && currentPolicy.id, currentPolicy && currentPolicy.version]);

  // Manual focus trap: Escape is swallowed (no close), and Tab/Shift+Tab
  // cycle only through the elements inside the gate card.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        return;
      }
      if (event.key !== 'Tab' || !containerRef.current) return;
      const focusable = Array.from(
        containerRef.current.querySelectorAll('button:not(:disabled), [tabindex]:not([tabindex="-1"])')
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDecline, currentPolicy]);

  function handleScroll(event) {
    const { scrollTop, scrollHeight, clientHeight } = event.target;
    if (scrollTop + clientHeight >= scrollHeight - 2) setCanAgree(true);
  }

  async function postDecision(decision) {
    if (!currentPolicy || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api('/policies/gate/decision', {
        method: 'POST',
        body: { policy_id: currentPolicy.id, version: currentPolicy.version, decision }
      });
      if (decision === 'declined') {
        onDeclined();
        return;
      }
      if (result.pending && result.pending.length > 0) {
        setPending(result.pending);
        setIndex(0);
      } else {
        const me = await api('/auth/me');
        onResolved(me);
      }
    } catch (decisionError) {
      if (decisionError.status === 409 && decisionError.body && decisionError.body.code === 'POLICY_VERSION_CHANGED') {
        setPending((current) => {
          const next = [...current];
          next[index] = decisionError.body.policy;
          return next;
        });
        setConfirmDecline(false);
        setError('This policy was updated while you were reviewing it. Please read the latest version and respond again.');
      } else {
        setError(decisionError.message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="aup-gate-screen"><p>Loading acceptable use policy...</p></div>;
  }

  if (!currentPolicy) {
    return <div className="aup-gate-screen"><p>{error || 'There is nothing to acknowledge.'}</p></div>;
  }

  return (
    <div className="aup-gate-screen">
      <section
        ref={containerRef}
        className="aup-gate-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aup-gate-title"
      >
        <h1 id="aup-gate-title">Acceptable Use Policy</h1>
        <div className="aup-gate-summary"><span className="badge badge-mandatory">REQUIRED BEFORE ACCESS</span><p className="aup-gate-version">Version {currentPolicy.version}</p></div>
        <p className="aup-gate-instructions"><strong>Review and respond to this policy</strong>
          You must read this policy in full and agree to it before you can use SinglePoint. If you
          disagree, your session will end immediately and you will be signed out.
        </p>
        <div
          ref={scrollRegionRef}
          className="aup-gate-text"
          tabIndex={0}
          role="region"
          aria-label="Policy text"
          onScroll={handleScroll}
        >
          {renderPolicyContent(currentPolicy.content)}
        </div>
        {error && <p className="error-message" role="alert">{error}</p>}
        {!confirmDecline && (
          <div className="aup-gate-actions">
            <button
              className="btn-primary"
              type="button"
              disabled={!canAgree || busy}
              onClick={() => postDecision('agreed')}
            >
              {busy ? 'Submitting...' : 'I agree'}
            </button>
            <button
              className="btn-secondary"
              type="button"
              disabled={busy}
              onClick={() => setConfirmDecline(true)}
            >
              I disagree
            </button>
          </div>
        )}
        {confirmDecline && (
          <div className="aup-gate-confirm">
            <p>Are you sure? Declining will end your session and sign you out immediately.</p>
            <div className="aup-gate-actions">
              <button
                className="btn-danger"
                type="button"
                disabled={busy}
                onClick={() => postDecision('declined')}
              >
                {busy ? 'Submitting...' : 'Yes, decline and leave'}
              </button>
              <button
                className="btn-secondary"
                type="button"
                disabled={busy}
                onClick={() => setConfirmDecline(false)}
              >
                Go back
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default AupGate;
