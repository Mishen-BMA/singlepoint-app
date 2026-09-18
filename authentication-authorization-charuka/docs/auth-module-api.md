# Authentication & Authorization Module — API Reference

Built by Charuka. Handles login, individual staff accounts, and role-based
access control for SinglePoint — replacing the single shared AnyDesk
credential (R01/R02 in the original risk register).

## Authentication

Every protected route requires:

Authorization: Bearer <token>

The token is returned by `POST /api/auth/login`. Tokens expire after 30
minutes of inactivity; every authenticated request returns a refreshed token
in the `X-Auth-Token` response header, which the frontend should store to
replace the old one.

## Endpoints

### `POST /api/auth/login`
**Body:** `{ "email": string, "password": string }`
**Returns:** `{ token, user: { id, name, email, role } }`, or `401` on bad
credentials.

### `POST /api/auth/logout`
Client-side logout is what actually matters (discard the token); this just
gives the frontend a clean endpoint to call.

### `GET /api/auth/me`
Returns the logged-in user's own profile (no password hash).

### `POST /api/users` — Admin only
Creates a new staff account.
**Body:** `{ "name": string, "email": string, "password": string, "role": "admin"|"manager"|"staff" }`

### `GET /api/users` — Admin only
Lists every user account (for the User Management screen, Figure 8).

## For the rest of the team

Swap your placeholder header-based middleware for this one — the exported
function names (`requireUser`, `requireAdmin`) are unchanged, so it's a
one-line import change in your routes file:

```js
// before
const { requireUser, requireAdmin } = require('../../policy management - mishen/middleware/auth');
// after
const { requireUser, requireAdmin } = require('../../authentication-authorization-charuka/middleware/auth');
```

After that, `req.user` is `{ id, role }` from a verified token instead of
trusted headers.

## Design notes (for viva reference)

- **Passwords are never stored or returned in plain text** — bcrypt hashes
  with a cost factor of 10, and `findUserByEmail`'s raw row (which includes
  the hash) is only ever used internally, never sent to the client.
- **JWT over server-side sessions** — keeps the backend stateless, which
  fits the "ordinary hosting, not designed for heavy load" non-functional
  requirement (Section 6) without needing a session store.
- **Sliding expiry, not a fixed one** — every authenticated request renews
  the token's 30-minute window, satisfying the "session ends after a period
  of inactivity" requirement while not logging out an actively-working user.
- **Role check happens server-side in middleware**, not just hidden in the
  frontend UI — this was the specific gap called out in Section 4, since the
  current AnyDesk access has no controls beyond a shared password.
- **Same error message for "no such user" and "wrong password"** on login,
  so a failed attempt can't be used to enumerate valid staff emails.
