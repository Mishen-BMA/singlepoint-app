# SinglePoint

Security policy awareness & compliance web app built for **Sallelanka Solutions (Pvt) Ltd**, a Colombo-based ERP/E-POS MSME.

## About

SinglePoint was built following a cybersecurity risk assessment conducted on Sallelanka Solutions. The project addresses shared remote-access credentials and missing policy and session accountability through individual logins, policy acknowledgement, targeted security training, incident reporting, and a management compliance dashboard.

This project is built for **IE3072 — Information Security Policy and Management**, SLIIT.

## Team — Group E3072_021

| Module |
|---|
| Authentication & Authorization |
| Policy Management |
| Security Training & Awareness |
| Compliance Tracking, Reporting & Incident Reporting |

## Tech Stack

- **Frontend:** React
- **Backend:** Node.js + Express
- **Database:** SQLite (dev) / PostgreSQL (prod)
- **Auth:** Session/JWT-based with bcrypt password hashing

## Getting Started

Requirements: Node.js 20 or newer and npm. SQLite is used automatically for local development; PostgreSQL is supported by setting `DATABASE_URL`.

1. Install dependencies in the repository and frontend directories:

	```bash
	npm install
	cd frontend
	npm install
	cd ..
	```

2. Create a root `.env` file with a strong random `JWT_SECRET`. Local SQLite defaults to `./data/singlepoint.sqlite`, or set `DATABASE_URL=sqlite:./data/singlepoint.sqlite`. For PostgreSQL, use a `postgresql://` connection string. Set `FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173` for local development.

3. Create the first administrator without storing a default password in source control. Set `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, and a unique `SEED_ADMIN_PASSWORD` of at least 12 characters in `.env`, then run:

	```bash
	npm run seed:admin
	```

4. Start the API and React app in separate terminals:

	```bash
	npm start
	```

	```bash
	cd frontend
	npm start
	```

The API listens on port 4000 by default. The frontend uses `http://localhost:4000/api`; set `VITE_API_URL` before building if the API is hosted elsewhere. Default policies, including the Acceptable Use Policy, and training modules are created idempotently at API startup. Administrators can create, deactivate, and reactivate accounts. Users can change their own passwords. Incomplete requirements become overdue after 30 days.

## Workflows

- Staff can sign in, acknowledge the current policy versions, complete a security-habits survey, take recommended quizzes, review reminders, change their password, and submit severity-rated incident reports.
- Managers can view organization compliance, send in-app reminders, review and triage incidents, view the sign-in audit log, and export a CSV report.
- Administrators can do the manager workflows, publish policy versions, inspect acknowledgement state, manage account roles and active status, and target training modules to roles.
- Training recommendations combine survey answers with role requirements. Incident-reporting training is required for managers and admins by default. Quizzes require at least 70% to pass.
- Authenticated requests use 30-minute sliding JWT sessions backed by revocable server-side session records. Logout and password changes revoke sessions. Successful/failed sign-ins, logout, and password changes are audited. Login attempts are rate-limited, Helmet supplies security headers, and HTTPS is enforced when `NODE_ENV=production`.
- The privacy notice describes collected data and access. Survey answers and personal training progress are visible only to the person who submitted them; managers and admins receive the compliance and incident access required by their roles.
- The in-app Acceptable Use Policy and [Word-ready policy source](docs/acceptable-use-policy.md) describe current app behavior. Update both whenever authentication, training thresholds, role permissions, or overdue rules change.

## Verification

```bash
npm test
npm --prefix frontend test
npm --prefix frontend run build
npm audit
npm audit --prefix frontend
```

The backend test suite runs against an isolated in-memory SQLite database. The frontend build and test suite are separate because the React app is maintained in `frontend/`.