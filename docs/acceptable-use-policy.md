# Acceptable Use Policy

**System:** SinglePoint security policy and compliance application  
**Organization:** Sallelanka Solutions (Pvt) Ltd  
**Applies to:** Staff, managers, and administrators with a SinglePoint account

## Purpose

Use SinglePoint and company systems only for authorized business purposes. This policy describes the safeguards currently enforced by the application and the expected handling of company access and security incidents.

## Accounts and passwords

- Each user must access the system with their own account. Sharing accounts or passwords is not permitted.
- New passwords must contain at least 12 characters and must fit within the application's 72-byte bcrypt input limit.
- Passwords are stored as bcrypt hashes, not as readable passwords.
- Change your password through Account security if it may have been exposed. A password change ends existing sessions and requires you to sign in again.
- Administrators must deactivate accounts that no longer need access. Deactivation blocks sign-in and revokes active sessions while retaining records needed for compliance history.

## Sessions and authorized access

- An authenticated session expires after 30 minutes without activity. Authenticated requests refresh the inactivity window.
- Signing out revokes the current server-side session.
- Staff can access their own policy, survey, training, reminder, and incident records.
- Managers can review team compliance, incidents, and sign-in audit events, and can issue in-app reminders.
- Administrators can manage user accounts, roles, policies, and training content, and can perform management review workflows.
- Do not attempt to access another user's private survey answers or training progress.

## Policies and training

- Read and acknowledge current policy versions that apply to your work.
- Complete training recommended by your survey answers or required for your role.
- A quiz score of at least 70% is required to pass.
- Required policy acknowledgements, surveys, and training that remain incomplete for 30 days are marked overdue.

## Incident reporting and data handling

- Report suspected account compromise, unexpected remote-access requests, lost devices, suspected policy violations, and other security concerns through the incident reporting feature as soon as possible.
- Provide an accurate description and choose the closest severity. Managers and admins review and update incident status.
- Use company and client information only as needed for assigned work. Do not put credentials or sensitive client information in personal notes or unapproved messaging channels.
- SinglePoint records account identity and role, policy acknowledgements, training and survey progress, incident reports, and sign-in time, IP address, and browser/device details. Management access to compliance and incident records is role-restricted; survey answers and personal training progress remain visible only to their submitter.

## Enforcement and review

Use of SinglePoint is subject to the organization's information-security procedures. Contact an administrator to report a concern or request help with account access. Review this policy whenever application behavior or organizational requirements change.