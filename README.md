# Team Directory

A team member directory with **role-based access control**. Users sign in, and
what they can see and do is enforced **on the server** by their role. Sensitive
fields (phone numbers, salary/HR) are only ever sent to authorized roles.

Built with Node.js + Express + SQLite. Designed spec-first with
[GitHub Spec Kit](https://github.com/github/spec-kit) — see
[`specs/001-rbac-access-control/`](specs/001-rbac-access-control/) for the
constitution, spec, plan, and tasks.

## Roles

| Capability                         | Viewer | Member | Admin |
|------------------------------------|:------:|:------:|:-----:|
| View names & non-sensitive fields  |   ✅   |   ✅   |  ✅   |
| View sensitive fields (phone, salary) | ❌  |   ❌   |  ✅   |
| Search by phone                    |   ❌   |   ❌   |  ✅   |
| Add / edit members                 |   ❌   |   ✅   |  ✅   |
| Delete members                     |   ❌   |   ❌   |  ✅   |
| Admin section (manage users/roles) |   ❌   |   ❌   |  ✅   |

Members can add/edit member records but **cannot** see or set sensitive fields —
those are admin-only, end to end (omitted from API responses, not just hidden in
the UI).

## Getting started

Requires Node.js 20+.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    then edit .env and set at least:
#      SESSION_SECRET   – a long random string
#      ADMIN_USERNAME   – the first admin's username
#      ADMIN_PASSWORD   – the first admin's password
#    (generate a secret: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")

# 3. Create the database + seed the initial admin and sample members
npm run seed

# 4. Run
npm start          # http://localhost:3000
# or: npm run dev  # auto-restart on file changes
```

Then open http://localhost:3000, sign in as the admin you configured, and use the
**Admin** section to create more users and assign their roles.

> The app reads `SESSION_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` from the
> environment. `.env` and the SQLite database (`data/`) are git-ignored — no
> secrets are committed.

## How access is enforced

- **Authentication**: username + password; passwords stored only as bcrypt
  hashes. Sessions use a signed, http-only cookie. Repeated failed logins are
  rate-limited.
- **Authorization**: every field and action is checked server-side against a
  central permission matrix (`server/permissions.js`). The frontend only tailors
  the UI — it is never the security boundary.
- **Sensitive data**: `serializeMember()` omits `phone` and `salary` from API
  responses for roles that lack permission, so they never leave the server.
- **Safe defaults**: unknown roles are denied; the last remaining admin cannot be
  demoted or deleted; security-relevant events are written to an audit log.

## Project layout

```
server/          Express app, SQLite, auth, permissions, routes
  permissions.js   role/capability matrix + serializeMember (single source of truth)
  routes/          auth.js, members.js, admin.js
  middleware/      auth.js (requireAuth/requireCapability), errors.js
public/          Frontend: login, directory (role-aware), admin panel
test/            node:test suites (permissions unit + API integration)
specs/           Spec Kit artifacts (spec, plan, tasks)
```

## Tests

```bash
npm test
```

Covers: unauthenticated access is blocked, sensitive fields are omitted for
Viewer/Member and present for Admin, viewers/members cannot perform actions
above their role (403), phone search is admin-only, and the last-admin guard.

## API summary

| Method | Path                     | Who        |
|--------|--------------------------|------------|
| POST   | `/api/login`             | anyone     |
| POST   | `/api/logout`            | signed-in  |
| GET    | `/api/me`                | signed-in  |
| GET    | `/api/members?q=`        | signed-in (role-scoped) |
| POST   | `/api/members`           | Member, Admin |
| PUT    | `/api/members/:id`       | Member, Admin (sensitive fields Admin-only) |
| DELETE | `/api/members/:id`       | Admin      |
| GET    | `/api/admin/users`       | Admin      |
| POST   | `/api/admin/users`       | Admin      |
| PUT    | `/api/admin/users/:id`   | Admin      |
| DELETE | `/api/admin/users/:id`   | Admin      |
