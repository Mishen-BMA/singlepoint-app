# SinglePoint

Security policy awareness & compliance web app built for **Sallelanka Solutions (Pvt) Ltd**, a Colombo-based ERP/E-POS MSME.

## About

SinglePoint was built following a cybersecurity risk assessment conducted on Sallelanka Solutions. The project addresses shared remote-access credentials and missing policy and session accountability through individual logins, policy acknowledgement, targeted security training, incident reporting, and a management compliance dashboard.

This project is built for **IE3072 - Information Security Policy and Management**, SLIIT.

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

- **Mandatory Acceptable Use Policy gate.** The Acceptable Use Policy is flagged to require a gate (`policies.requires_gate`). Right after signing in, any user with a pending or stale agreement for a gate policy can do nothing else in the app: every API route except `GET /auth/me`, `POST /auth/logout`, `GET /policies/gate`, and `POST /policies/gate/decision` returns `403 { code: 'AUP_REQUIRED' }` until they respond. The frontend shows a full-screen, non-dismissible dialog (no close button; Escape and clicking outside do nothing) with the current policy text. "I agree" stays disabled until the user scrolls to the end of the text (or immediately if it fits without scrolling). Agreeing records the decision and unlocks the app; disagreeing records the decision, immediately revokes the session, and signs the user out. If an admin publishes a new version of a gate policy while users are signed in, everyone (including the admin) is sent back to the gate on their next request and must respond again — a stale-version response is rejected with `409 { code: 'POLICY_VERSION_CHANGED' }` and the latest text. Acknowledgement rows are append-only, so the full history of agree/decline decisions per user and policy version is preserved and is visible to admins via `GET /policies/:id/acknowledgement-history`.
- Staff can sign in, acknowledge the current policy versions, complete a security-habits survey, take recommended quizzes, review reminders, change their password, and submit severity-rated incident reports.
- Managers can view organization compliance, send in-app reminders, review and triage incidents, view the sign-in audit log, and export a CSV report.
- Administrators can do the manager workflows, publish policy versions, inspect acknowledgement state, manage account roles and active status, and target training modules to roles.
- Training recommendations combine survey answers with role requirements. Incident-reporting training is required for managers and admins by default. Quizzes require at least 70% to pass.
- Authenticated requests use 30-minute sliding JWT sessions backed by revocable server-side session records. Logout and password changes revoke sessions. Successful/failed sign-ins, logout, and password changes are audited. Login attempts are rate-limited, Helmet supplies security headers, and HTTPS is enforced when `NODE_ENV=production`.
- The privacy notice describes collected data and access. Survey answers and personal training progress are visible only to the person who submitted them; managers and admins receive the compliance and incident access required by their roles.
- The in-app Acceptable Use Policy and [Word-ready policy source](docs/acceptable-use-policy.md) describe current app behavior. Update both whenever authentication, training thresholds, role permissions, or overdue rules change.

## Deployment

The frontend is published to GitHub Pages at `https://mishen-bma.github.io/singlepoint-app/`, and the API is hosted separately (for example on Render), since Pages only serves static files.

### Frontend — GitHub Pages

- [.github/workflows/pages-build-deploy.yml](.github/workflows/pages-build-deploy.yml) builds `frontend/` with Vite and publishes `frontend/dist` via GitHub's official Pages actions whenever `main` changes.
- In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
- The workflow builds with `VITE_BASE_PATH=/singlepoint-app/` so asset URLs match the Pages subpath. Set a repository **variable** (not secret) named `VITE_API_URL` under **Settings → Secrets and variables → Actions → Variables**, pointing at the deployed API, e.g. `https://<your-render-service>.onrender.com/api`.
- After the first successful deploy, consider setting the published URL in **Settings → General → About → Website**.

### Backend — Render (or any Node host)

- [render.yaml](render.yaml) is a Render Blueprint for a free Node web service (`npm ci` / `npm start`). Non-sensitive variables (`NODE_ENV`, `PGSSLMODE`, `FRONTEND_ORIGIN`) are defined inline; `DATABASE_URL` and `JWT_SECRET` are declared with `sync: false` so Render prompts you to enter real values in its dashboard instead of storing them in source control.
- Point `DATABASE_URL` at a managed PostgreSQL database (e.g. Supabase's session pooler connection string) rather than Render's free Postgres, which expires after 30 days.
- Run `npm run seed:admin` locally against the production `DATABASE_URL` with `SEED_ADMIN_*` variables set only in your local shell/`.env`, since Render's free plan doesn't support one-off jobs.
- Never commit real connection strings or secrets; rotate any credential that has been exposed before reusing it.

## Verification

```bash
npm test
npm --prefix frontend test
npm --prefix frontend run build
npm audit
npm audit --prefix frontend
```

The backend test suite runs against an isolated in-memory SQLite database. The frontend build and test suite are separate because the React app is maintained in `frontend/`.
