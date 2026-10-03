function PrivacyNotice({ compact = false }) {
  const content = (
    <>
      <p>SinglePoint collects your name, work email, role, policy acknowledgements, training survey answers and quiz results, incident reports, and account activity such as sign-in time, IP address, and browser/device details.</p>
      <p>Your survey answers and personal training progress are visible to you. Managers can see team compliance status and incident reports; admins can manage user accounts and view compliance and incident records. Management users can review the sign-in audit log.</p>
      <p>Use the system only for work security and compliance. Contact your administrator to ask about your records or report a concern.</p>
    </>
  );

  if (compact) return <div className="privacy-copy">{content}</div>;
  return <section className="data-section privacy-notice"><span className="eyebrow">DATA AND ACCESS</span><h2>Privacy notice</h2>{content}</section>;
}

export default PrivacyNotice;