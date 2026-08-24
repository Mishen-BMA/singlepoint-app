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

```bash
git clone <repo-url>
cd singlepoint
npm install
node server.js
```

## Branching

Each member works on their own branch (`mishen`, `charuka`, `nihara`, `sadini`) and merges into `main` via Pull Request, reviewed before merging.