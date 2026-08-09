# Tasks: Multi-User Role-Based Access Control

**Feature**: `001-rbac-access-control` | **Plan**: [plan.md](./plan.md)

Legend: `[P]` = can be done in parallel with siblings. Each task references the
FR/story it satisfies.

## Phase 0 — Project setup

- [x] T001 Initialize Node project: `package.json` (type=module, scripts:
  start/dev/seed/test), install express, better-sqlite3, express-session,
  bcryptjs, helmet; add `.gitignore` (node_modules, .env, *.sqlite) and
  `.env.example`. (setup)
- [x] T002 `server/db.js`: open SQLite, create `users`, `members`, `audit`
  tables if absent. (FR-020)
- [x] T003 `server/permissions.js`: define ROLES, permission matrix,
  `can(role, capability)`, and `serializeMember(member, role)` that omits
  sensitive keys. (FR-005..013)
- [x] T004 `server/audit.js`: `recordEvent(actorId, event, detail)`. (FR-021)

## Phase 1 — Auth + role-scoped directory (P1, MVP)

- [x] T005 `server/seed.js`: first-run create initial Admin from env
  (ADMIN_USERNAME/PASSWORD) + two sample members. Idempotent. (FR-002, assumptions)
- [x] T006 `server/middleware/auth.js`: `requireAuth` (401/redirect),
  `requireRole(...roles)` (403), attach `req.user`. (FR-001,006,010)
- [x] T007 `server/routes/auth.js`: POST /api/login (bcrypt compare, throttle),
  POST /api/logout, GET /api/me. (FR-001..004)
- [x] T008 `server/routes/members.js` (read path): GET /api/members?q= —
  role-scoped via serializeMember; phone search admin-only. (FR-007,012,019)
- [x] T009 `server/index.js`: wire helmet, session (http-only same-site cookie),
  static `public/`, routes, error handler; gate pages behind auth. (FR-003)
- [x] T010 `public/login.html` + login logic in `app.js`. (US1)
- [x] T011 `public/index.html` + `public/app.js`: role-aware directory —
  render only fields/controls the API/me role permits (keeps existing design). (US1)
- [x] T012 [P] `test/permissions.test.js`: serializeMember hides phone/salary for
  viewer/member, shows for admin. (SC-002)
- [x] T013 [P] `test/auth.test.js`: unauth → 401; bad creds → 401; good → session. (SC-001)

## Phase 2 — Admin section (P2)

- [x] T014 `server/routes/admin.js`: GET/POST/PUT/DELETE /api/admin/users
  (admin-only), never return password hashes; last-admin guard on demote/delete/
  deactivate. (FR-014..018)
- [x] T015 `public/admin.html` + `public/admin.js`: user list, create user
  (username/password/role), change role, reset password, deactivate/delete. (US2)
- [x] T016 [P] `test/admin.test.js`: non-admin → 403; create user + role applies;
  last-admin cannot be demoted/deleted. (SC-003,004,005)

## Phase 3 — Sensitive-data hardening + write rules + audit (P3)

- [x] T017 `server/routes/members.js` (write path): POST (member+admin),
  PUT (member+admin; phone/salary writable only by admin), DELETE (admin);
  validate input, parameterized SQL. (FR-008,009,010,019)
- [x] T018 Central error handler + logging scrub: ensure no sensitive value
  appears in error responses/logs for unauthorized roles. (FR-013)
- [x] T019 Wire audit events into login, user create/delete, role change. (FR-021)
- [x] T020 [P] `test/members.test.js`: viewer cannot write (403); member can add
  but cannot set salary; member API payload omits sensitive keys; admin full. (SC-002,003)

## Phase 4 — Docs & finalize

- [x] T021 Update `README.md`: setup, env vars, roles table, how to run/seed/test.
- [x] T022 Manual smoke test per role; run `npm test`; verify all acceptance
  scenarios; then commit and push.

## Dependencies

- Phase 0 before all. T006 before routes. T007/T008 before T011. Phase 2/3
  depend on Phase 1 auth. Tests can be written alongside their targets.
