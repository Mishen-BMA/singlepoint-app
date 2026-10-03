# SinglePoint

Security policy awareness & compliance web app built for **Sallelanka Solutions (Pvt) Ltd**, a Colombo-based ERP/E-POS MSME.

## About

SinglePoint was built following a real cybersecurity risk assessment (IE3052, Group 49) conducted on Sallelanka Solutions, which found 18 documented risks — most critically a single shared remote-access credential used across 250+ client systems, no written security policy, and no session logging. SinglePoint addresses these gaps directly by giving staff individual logins, tracking policy acknowledgement, delivering targeted security training, and giving management a compliance dashboard.

This project is built for **IE3072 — Information Security Policy and Management**, SLIIT.

## Team — Group 49

| Member | Module |
|---|---|
| Charuka Weerasinghe | Authentication & Authorization |
| Mishen | Policy Management |
| Nihara Dewindini | Security Training & Awareness |
| Sadini Liyanamana | Compliance Tracking, Reporting & Incident Reporting |

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

The API listens on port 4000 by default. The frontend uses `http://localhost:4000/api`; set `VITE_API_URL` before building if the API is hosted elsewhere. Default policies and training modules are created idempotently at API startup. Administrators can create staff accounts from User Management. Incomplete items become overdue after 30 days.

## Workflows

- Staff can sign in, acknowledge the current policy versions, complete a security-habits survey, take recommended quizzes, review reminders, and submit incident reports.
- Managers can view organization compliance, send in-app reminders, review incidents, and export a CSV report.
- Administrators can do the manager workflows, publish policy versions, inspect every user's acknowledgement state, and create or change account roles.
- Authenticated API requests use short-lived JWTs. Each request refreshes the inactivity window; the browser replaces its token from the exposed response header. HTTPS is enforced when `NODE_ENV=production`, so production must terminate TLS at the app or a trusted reverse proxy.

## Verification

```bash
npm test
npm --prefix frontend test
npm --prefix frontend run build
```

The backend test suite runs against an isolated in-memory SQLite database. The frontend build and test suite are separate because the React app is maintained in `frontend/`.