# Feature Specification: Multi-User Role-Based Access Control

**Feature Branch**: `claude/team-member-search-app-kl5cq6` (feature `001-rbac-access-control`)

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Create a multi-access approach for the team database with different user levels, different visibility of data and credentials access, and an admin section for the super user to set access."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and see only what my role allows (Priority: P1)

A team member opens the app and is required to sign in. After signing in, they
see the team directory filtered to exactly the data their role permits: an Admin
sees everyone with all fields (including phone and salary/HR); a Member sees the
directory with sensitive fields hidden; a Viewer sees a read-only directory with
sensitive fields hidden.

**Why this priority**: This is the core of the request — authenticated access
with role-scoped visibility. Without it there is no product. It is the MVP.

**Independent Test**: Create one user of each role, sign in as each, and confirm
the API responses and UI show only the permitted fields and actions. Confirm an
unauthenticated request to the data API is rejected.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** they open any app page or call
   the members API, **Then** they are redirected to / rejected by login and see
   no member data.
2. **Given** a signed-in Viewer, **When** they load the directory, **Then** they
   see names and non-sensitive fields, no phone or salary, and no add/edit/delete
   controls.
3. **Given** a signed-in Member, **When** they load the directory, **Then** they
   see non-sensitive fields plus add/edit controls, but still no phone or salary.
4. **Given** a signed-in Admin, **When** they load the directory, **Then** they
   see all fields including phone and salary/HR for every member.
5. **Given** a Viewer, **When** they call a mutating endpoint directly (e.g. POST
   /api/members), **Then** the server rejects it with 403 regardless of the UI.

---

### User Story 2 - Admin manages users and their access (Priority: P2)

A super user (Admin) opens an Admin section to create user accounts, assign or
change each user's role, reset passwords, and deactivate/delete users. This is
how access is "set" per the request.

**Why this priority**: The request explicitly asks for an admin section for the
super user to set access. It depends on P1's auth foundation but is the second
essential slice.

**Independent Test**: Sign in as Admin, create a new Member user, sign out, sign
in as that new user, and confirm the assigned role's visibility applies. Change
the user's role to Viewer and confirm behavior changes accordingly.

**Acceptance Scenarios**:

1. **Given** an Admin in the Admin section, **When** they create a user with a
   role, **Then** that user can sign in and receives exactly that role's access.
2. **Given** an Admin, **When** they change a user's role, **Then** the change
   takes effect on that user's next request/session without code changes.
3. **Given** a non-Admin, **When** they navigate to or call any admin endpoint,
   **Then** the server returns 403 and the Admin UI is not rendered.
4. **Given** the only remaining Admin, **When** an attempt is made to demote or
   delete them, **Then** the system refuses to leave zero admins.

---

### User Story 3 - Sensitive credentials are protected end-to-end (Priority: P3)

Sensitive fields (phone numbers, salary/HR data) are never delivered to a client
whose role lacks permission — not merely hidden in the UI. An Admin can view and
edit them; lower roles never receive them over the wire.

**Why this priority**: Hardens the visibility rules from P1 against inspection
(dev tools, direct API calls). Critical for real confidentiality, but builds on
P1 being in place.

**Independent Test**: As a Member/Viewer, inspect the raw members API response
and confirm sensitive keys are absent (not null-with-CSS-hidden). As an Admin,
confirm they are present and editable.

**Acceptance Scenarios**:

1. **Given** a Member, **When** the members API is inspected, **Then** the
   `phone` and `salary` fields are absent from the JSON payload.
2. **Given** an Admin, **When** the members API is inspected, **Then** sensitive
   fields are present and can be updated.
3. **Given** any role, **When** an error occurs, **Then** no sensitive field
   value appears in the error message or server logs for unauthorized roles.

---

### Edge Cases

- **Unauthenticated deep link**: hitting an app URL or API route without a valid
  session redirects to login (pages) or returns 401 (API), never partial data.
- **Session expiry / logout**: an expired or absent session behaves as
  unauthenticated on the next request.
- **Last admin protection**: demoting or deleting the final Admin is refused.
- **Self-demotion**: an Admin demoting themselves is allowed only if another
  Admin remains.
- **Duplicate username/email** at user creation is rejected with a clear message.
- **Empty/malformed inputs** (missing name, bad role value) are rejected server-side.
- **Direct privilege escalation attempt**: a Member POSTing a role change or an
  admin action receives 403.
- **Brute-force login**: repeated failures are throttled/locked.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication**
- **FR-001**: System MUST require authentication (username/email + password)
  before any member data or app page (other than login) is served.
- **FR-002**: System MUST store passwords only as bcrypt hashes (cost >= 10).
- **FR-003**: System MUST maintain sessions via signed, http-only cookies and
  provide sign-out that invalidates the session.
- **FR-004**: System MUST throttle or lock out repeated failed login attempts.

**Authorization & Roles**
- **FR-005**: System MUST support exactly three roles: Viewer, Member, Admin.
- **FR-006**: System MUST enforce every access decision server-side; the UI MUST
  NOT be the sole gate for any field or action.
- **FR-007**: Viewer MUST have read-only access to non-sensitive member fields.
- **FR-008**: Member MUST be able to read non-sensitive fields and create/edit
  member records, but MUST NOT see sensitive fields.
- **FR-009**: Admin MUST have full read/write access to all fields including
  sensitive ones, plus access to the Admin section.
- **FR-010**: System MUST reject (403) any request for data or actions beyond the
  caller's role, independent of the UI.

**Sensitive Data**
- **FR-011**: System MUST classify `phone` and salary/HR fields as sensitive.
- **FR-012**: System MUST omit sensitive fields from API responses for roles
  without permission (omit, not send-and-hide).
- **FR-013**: System MUST keep sensitive values out of logs and error responses
  for unauthorized roles.

**Admin Section (super-user access management)**
- **FR-014**: Admin MUST be able to create user accounts with an assigned role.
- **FR-015**: Admin MUST be able to change a user's role.
- **FR-016**: Admin MUST be able to reset a user's password and deactivate/delete
  a user.
- **FR-017**: System MUST prevent the number of Admins from reaching zero (last
  Admin cannot be demoted or deleted).
- **FR-018**: All admin endpoints MUST be reachable only by Admins.

**Members data & search**
- **FR-019**: System MUST preserve existing capabilities — search members by name
  or phone (phone search available only to roles that can see phone), add and
  delete members (per role) — now backed by the server database.
- **FR-020**: System MUST persist members and users in a real database (not
  browser localStorage).

**Audit**
- **FR-021**: System MUST log security-relevant events: login success/failure,
  user create/delete, and role changes.

### Key Entities *(include if feature involves data)*

- **User**: an account that can sign in. Attributes: id, username/email,
  password hash, role (Viewer/Member/Admin), active flag, created timestamp.
- **Member**: a team directory entry (the data being searched). Attributes: id,
  name (non-sensitive), phone (sensitive), salary/HR fields (sensitive), plus
  optional non-sensitive fields (e.g., title/department). A Member entry is data;
  a User is an account — they are distinct.
- **Role**: one of Viewer, Member, Admin, each mapping to a fixed permission set
  (field visibility + allowed actions).
- **AuditEvent**: a recorded security-relevant action: id, actor user, event
  type, target, timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An unauthenticated request to any data endpoint returns 0 member
  records (100% blocked).
- **SC-002**: For Viewer and Member roles, sensitive fields appear in 0% of API
  responses; for Admin, in 100% of responses.
- **SC-003**: 100% of mutating and admin endpoints reject unauthorized roles with
  403 when called directly, bypassing the UI.
- **SC-004**: An Admin can create a user and assign a role in under 1 minute, and
  the new user's access reflects that role on first login.
- **SC-005**: It is never possible to reach a state with zero Admin accounts.
- **SC-006**: Passwords are unrecoverable from the database (only hashes stored).

## Assumptions

- Small team scale (tens of users), single-instance deployment; SQLite is
  sufficient and no external auth provider is required.
- Username/email + password auth is acceptable (no SSO/OAuth for v1).
- "Credentials access" refers to protecting sensitive member fields (phone,
  salary/HR) and the app's own login credentials — not storing third-party
  secrets per member (can be added later as another sensitive field).
- The existing search/add/delete UX and visual design are retained; this feature
  adds auth, roles, a backend, and the admin section around it.
- Seed data: the app ships with the two sample members and one initial Admin
  account (credentials set via environment/first-run setup, not committed).
- Web app on desktop/mobile browsers; native apps out of scope for v1.
