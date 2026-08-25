# Policy Management Module — API Reference

Built by Mishen. Handles security policy publishing, staff acknowledgement, and compliance tracking for SinglePoint.

## Authentication

Every route requires two headers identifying the caller (this is a placeholder until Charuka's Auth module is integrated — it will eventually be set automatically from a login session/token instead of being sent manually):

x-user-id: <number>
x-user-role: admin | staff


Missing either header returns `401 Unauthorized`. Routes marked **Admin only** below also require `x-user-role: admin`, and return `403 Forbidden` otherwise.

## Endpoints

### `POST /api/policies` — Admin only
Create a new policy. Starts at version 1.

**Body:** `{ "title": string, "content": string }`
**Returns:** the created policy, including its `id`.

### `GET /api/policies`
List every policy, most recent first.

### `PUT /api/policies/:id` — Admin only
Update a policy's title/content. Automatically increments its `version` — this means anyone who already acknowledged the old version will now show as non-compliant until they re-acknowledge.

**Body:** `{ "title": string, "content": string }`

### `POST /api/policies/acknowledge`
A staff member marks a policy as read. Records which **version** they acknowledged, based on the policy's current version at that exact moment.

**Body:** `{ "policy_id": number, "user_id": number }`

### `GET /api/policies/:id/acknowledgements` — Admin only
See every acknowledgement recorded for one specific policy.

### `GET /api/compliance/:policyId/:userId`
Check whether one user is compliant on one policy — `compliant` is `true` only if the version they last acknowledged matches the policy's current version.

### `GET /api/compliance/:userId`
Full compliance picture for one user across **every** policy — including policies they've never acknowledged at all (`versionAcknowledged: null`). This is the endpoint the compliance dashboard is built on.

## Design notes (for viva reference)

- **Two tables, not one** — `policies` and `acknowledgements` are separate because one policy can have many acknowledgements (a one-to-many relationship). Combining them would repeat the policy text for every person who acknowledges it.
- **Parameterized SQL queries throughout** — every value from the request body is passed as a `?` placeholder, never concatenated directly into SQL strings. This prevents SQL injection.
- **Version bump happens in SQL (`version = version + 1`)**, not in JavaScript, to avoid a race condition if two updates happened at the same moment.
- **Compliance is calculated, not stored** — there's no `is_compliant` column anywhere. It's worked out live by comparing `version_acknowledged` to the policy's current `version`. This means it's always accurate and can never go stale.
- **`LEFT JOIN` (not `JOIN`) in the compliance overview** — ensures policies a user has never acknowledged still appear in results, which is exactly what a compliance dashboard needs to surface.
