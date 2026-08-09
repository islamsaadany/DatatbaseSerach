# Implementation Plan: Multi-User Role-Based Access Control

**Feature**: `001-rbac-access-control` | **Spec**: [spec.md](./spec.md) | **Date**: 2026-08-09

## Summary

Turn the static single-file team search app into a small client/server web
application with authentication, three server-enforced roles (Viewer, Member,
Admin), role-scoped field visibility (phone + salary/HR are sensitive), and an
Admin section for the super user to manage users and access. Data moves from
browser localStorage into a SQLite database.

## Technical Context

- **Language/Runtime**: Node.js 22, JavaScript (ES modules).
- **Server**: Express.
- **Database**: SQLite via `better-sqlite3` (synchronous, single-file, zero external service).
- **Auth**: `express-session` with an http-only signed cookie; `bcryptjs` for password hashing.
- **CSRF/headers**: same-site=lax cookies; `helmet` for security headers.
- **Frontend**: server-rendered static HTML/CSS/JS (keeps the existing design),
  talking to a JSON API. No SPA framework.
- **Testing**: Node's built-in `node:test` + `supertest` for API/authz tests.
- **Config/secrets**: `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` via
  environment (`.env` for local dev, git-ignored). Never committed.

## Constitution Check

| Principle | How the plan satisfies it |
|---|---|
| I. Server-enforced authz | All field filtering + action checks live in Express middleware/handlers; the client only renders what the API returns. |
| II. Least privilege | Role defaults to Viewer; permission matrix central and explicit. |
| III. Sensitive end-to-end | A `serializeMember(member, role)` function omits `phone`/`salary` keys for non-Admin before JSON is sent. |
| IV. Secure credentials | bcrypt cost 12; http-only same-site session cookie; secrets from env. |
| V. Audit & safe defaults | `audit` table + helper; last-admin guard; deny-by-default middleware. |

No violations. No complexity deviations to record.

## Project Structure

```
DatatbaseSerach/
├── package.json
├── .env.example                # documents required env vars (no secrets)
├── .gitignore                  # node_modules, .env, *.sqlite
├── server/
│   ├── index.js                # app entry: express wiring, static, listen
│   ├── db.js                   # better-sqlite3 connection + schema/migrations
│   ├── seed.js                 # first-run: create initial admin + sample members
│   ├── permissions.js          # ROLES, permission matrix, serializeMember()
│   ├── audit.js                # recordEvent() helper
│   ├── middleware/
│   │   ├── auth.js             # requireAuth, requireRole(...)
│   │   └── errors.js           # central error handler (no sensitive leakage)
│   └── routes/
│       ├── auth.js             # POST /api/login, POST /api/logout, GET /api/me
│       ├── members.js          # CRUD + search, role-scoped
│       └── admin.js            # user management (admin only)
├── public/                     # served static frontend (existing design, upgraded)
│   ├── login.html
│   ├── index.html              # directory (role-aware)
│   ├── admin.html              # admin section
│   ├── app.js
│   ├── admin.js
│   └── styles.css
└── test/
    ├── auth.test.js
    ├── permissions.test.js     # serializeMember field visibility
    ├── members.test.js         # role-scoped CRUD + 403s
    └── admin.test.js           # user mgmt + last-admin guard
```

## Data Model

**users**: `id` PK, `username` UNIQUE NOT NULL, `password_hash` NOT NULL,
`role` NOT NULL CHECK in ('viewer','member','admin'), `active` INTEGER DEFAULT 1,
`created_at` TEXT.

**members**: `id` PK, `name` NOT NULL, `title` TEXT, `department` TEXT,
`phone` TEXT (sensitive), `salary` TEXT (sensitive), `created_at` TEXT.

**audit**: `id` PK, `actor_id`, `event` TEXT, `detail` TEXT, `created_at` TEXT.

## Permission Matrix

| Capability | Viewer | Member | Admin |
|---|:--:|:--:|:--:|
| View non-sensitive member fields | ✅ | ✅ | ✅ |
| View sensitive fields (phone, salary) | ❌ | ❌ | ✅ |
| Search by phone | ❌ | ❌ | ✅ |
| Add / edit member | ❌ | ✅ | ✅ |
| Delete member | ❌ | ❌ | ✅ |
| Admin section (manage users/roles) | ❌ | ❌ | ✅ |

## API Contract (summary)

- `POST /api/login` {username,password} → sets session; 401 on bad creds; throttled.
- `POST /api/logout` → clears session.
- `GET /api/me` → {id, username, role} or 401.
- `GET /api/members?q=` → role-scoped array (sensitive keys omitted per role).
- `POST /api/members` (member+admin) → create.
- `PUT /api/members/:id` (member+admin; salary/phone writable only by admin) → update.
- `DELETE /api/members/:id` (admin) → delete.
- `GET /api/admin/users` (admin) → list users (no hashes).
- `POST /api/admin/users` (admin) → create user {username,password,role}.
- `PUT /api/admin/users/:id` (admin) → change role / active / reset password.
- `DELETE /api/admin/users/:id` (admin) → delete (last-admin guarded).

## Phasing (maps to user stories)

- **Phase 1 (P1, MVP)**: DB + auth + session + login page + role-scoped
  `GET /api/members` + role-aware directory UI. Deliverable: sign in, see
  role-correct data; unauth blocked.
- **Phase 2 (P2)**: Admin section — user CRUD, role assignment, last-admin guard.
- **Phase 3 (P3)**: End-to-end sensitive-field hardening + member write rules +
  audit logging + tests proving omission and 403s.

## Risks & Mitigations

- **Secret leakage** → `.env` git-ignored; `.env.example` documents; seed reads env.
- **better-sqlite3 native build** on this platform → Node 22 present; fall back to
  `node:sqlite` (built-in, Node 22) if the native module fails to install.
- **Breaking existing UX** → keep the current design/markup; layer auth around it.
