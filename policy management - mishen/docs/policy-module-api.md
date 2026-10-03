# Policy Management Module — API Reference

Built by Mishen. Handles security policy publishing, staff acknowledgement, the mandatory Acceptable Use Policy gate, and compliance tracking for SinglePoint.

## Authentication

Every route requires a valid session, established by signing in through Charuka's Auth module (`POST /api/auth/login`). Send the issued JWT as a bearer token:

Authorization: Bearer <token>

Missing or invalid tokens return `401 Unauthorized`. Routes marked **Admin only** below additionally require the authenticated user's role to be `admin`, and return `403 Forbidden` otherwise.

Most routes also require the caller to have agreed to the current version of every **gate policy** (currently just the Acceptable Use Policy). If they have not, the request is rejected with `403 { error: ..., code: 'AUP_REQUIRED' }` regardless of role. The only routes exempt from this check are `GET /api/auth/me`, `POST /api/auth/logout`, and the two gate endpoints below — everything else, including this module's own routes, is blocked until the user responds to the gate.

## Endpoints

### `POST /api/policies` — Admin only
Create a new policy. Starts at version 1 and defaults to `requires_gate: false`.

**Body:** `{ "title": string, "content": string }`
**Returns:** the created policy, including its `id`.

### `GET /api/policies`
List every policy, most recent first, each annotated with the caller's latest `decision` (`agreed`/`declined`/`null`), `version_acknowledged`, `compliant`, `overdue`, and a summary `status` (`acknowledged` | `declined` | `overdue` | `pending`).

### `PUT /api/policies/:id` — Admin only
Update a policy's title/content. Automatically increments its `version` — this means anyone who already acknowledged the old version (including the admin who made the change) will now show as non-compliant until they re-acknowledge. If the policy `requires_gate`, every signed-in user is sent back to the mandatory gate on their next request.

**Body:** `{ "title": string, "content": string }`

### `POST /api/policies/acknowledge`
A user marks a **non-gate** policy as read. Records which **version** they acknowledged (`decision: 'agreed'`), based on the policy's current version at that exact moment.

**Body:** `{ "policy_id": number }` — the authenticated user's ID is taken from `req.user`, not the request body.

Calling this for a policy with `requires_gate: true` returns `409 { code: 'USE_GATE_ENDPOINT' }` — gate policies must go through the gate endpoints below instead, so every decision is captured with an explicit `decision`, IP address, and user agent.

### `GET /api/policies/gate`
Returns `{ pending: Policy[] }` — the gate policies the authenticated user still needs to respond to (empty once they are all agreed at their current version). Does **not** require the gate check itself, since it is how a gated user discovers what they still need to do.

### `POST /api/policies/gate/decision`
Record the authenticated user's decision on one gate policy. Does **not** require the gate check itself.

**Body:** `{ "policy_id": number, "version": number, "decision": "agreed" | "declined" }` — `version` must match the policy's *current* version; this guards against a user agreeing to text they read before someone else just published a newer version.

- On a version mismatch: `409 { code: 'POLICY_VERSION_CHANGED', policy: { id, title, content, version } }` — the caller should show the returned (now-current) text and ask the user to respond again.
- On `"agreed"`: inserts an acknowledgement row (idempotent — re-agreeing at the same version does not create a duplicate row) and returns `201 { ok: true, pending: Policy[] }` (the user's still-pending gate policies, if more than one exists).
- On `"declined"`: inserts a `decision: 'declined'` row, then **always** revokes the caller's current session (even if recording the decision fails) and removes any refreshed session token from the response, so the user is signed out immediately. Returns `200 { ok: true, declined: true }`.

### `GET /api/policies/:id/acknowledgements` — Admin only
The latest acknowledgement status for every user against one specific policy (one row per user), including `status`, `compliant`, and `overdue`.

### `GET /api/policies/:id/acknowledgement-history` — Admin only
Every acknowledgement row ever recorded for one policy, newest first — append-only, so this is the full audit trail of every agree/decline decision at every version, per user.

### `GET /api/compliance/:policyId/:userId`
Check whether one user is compliant on one policy — `compliant` is `true` only if their **latest** decision for that policy is `agreed` at the policy's current version. A later `declined` decision, even at the current version, is not compliant.

### `GET /api/compliance/:userId`
Full compliance picture for one user across **every** policy — including policies they've never acknowledged at all (`versionAcknowledged: null`). This is the endpoint the compliance dashboard is built on.

## Design notes (for viva reference)

- **Two tables, not one** — `policies` and `acknowledgements` are separate because one policy can have many acknowledgements (a one-to-many relationship). Combining them would repeat the policy text for every person who acknowledges it.
- **Acknowledgements are append-only** — agreeing, disagreeing, and re-agreeing after a version bump each insert a new row rather than update an existing one. This preserves a complete, tamper-evident history instead of overwriting it.
- **"Latest decision" is found by `MAX(id)`, not by timestamp** — `acknowledged_at` is stored as plain text on SQLite and can tie between rows inserted in the same instant; the auto-incrementing `id` is the only unambiguous ordering, so every "current status" query picks the row where `id = MAX(id)` for that user/policy pair.
- **Parameterized SQL queries throughout** — every value from the request body is passed as a placeholder, never concatenated directly into SQL strings. This prevents SQL injection.
- **Version bump happens in SQL (`version = version + 1`)**, not in JavaScript, to avoid a race condition if two updates happened at the same moment.
- **Compliance is calculated, not stored** — there's no `is_compliant` column anywhere. It's worked out live by comparing the latest `decision`/`version_acknowledged` to the policy's current `version`. This means it's always accurate and can never go stale.
- **`LEFT JOIN`/`CROSS JOIN` with correlated subqueries (not `JOIN`) in the compliance and acknowledgement-listing queries** — ensures policies or users with no acknowledgement at all still appear in results, which is exactly what a compliance dashboard needs to surface.
- **The gate is enforced in middleware, not in each controller** — `requireUser` (used by nearly every route in the app) wraps `requireSession` and then checks `getPendingGatePolicies` for the caller, so no individual route handler needs to remember to perform the check.
