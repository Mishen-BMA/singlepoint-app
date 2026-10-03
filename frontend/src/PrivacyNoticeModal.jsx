import { useEffect, useRef } from 'react';
import PrivacyNotice from './PrivacyNotice';

function PrivacyNoticeModal({ onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div className="privacy-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="privacy-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-modal-title">
        <header className="privacy-modal-header">
          <h2 id="privacy-modal-title">Privacy notice</h2>
          <button ref={closeButtonRef} className="btn-secondary" onClick={onClose} aria-label="Close privacy notice">Close</button>
        </header>
        <PrivacyNotice compact />
      </section>
    </div>
  );
}

export default PrivacyNoticeModal;