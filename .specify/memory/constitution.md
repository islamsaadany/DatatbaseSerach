# Team Directory Constitution

## Core Principles

### I. Server-Enforced Authorization (NON-NEGOTIABLE)
Every access decision — who may read a field, edit a record, or reach the admin
section — MUST be enforced on the server. The client is treated as untrusted: UI
that hides a field is a convenience, never a security boundary. No endpoint may
return data or perform an action the caller's role does not permit, even if the
UI would never request it. "View Source" must reveal nothing a user is not
authorized to see.

### II. Least-Privilege Roles
Access is granted by role, lowest privilege by default. Three roles exist:
- **Viewer**: read-only, non-sensitive fields only.
- **Member**: read + create/edit member records, non-sensitive fields only.
- **Admin**: full access to all fields (including sensitive), plus the admin
  section to manage users and roles.
A new user with no assigned role gets the least capability, not the most.

### III. Sensitive Fields Are Protected End-to-End
Fields classified as sensitive (phone numbers, salary/HR data) MUST be omitted
from API responses for roles that lack permission — not sent-then-hidden. They
MUST never appear in logs, error messages, or client-side state for
unauthorized roles.

### IV. Secure Credential Handling
Passwords MUST be stored only as salted hashes (bcrypt/argon2-class), never in
plaintext or reversibly encrypted. Sessions MUST use signed, http-only cookies
(or equivalently protected tokens). Authentication and authorization failures
MUST be logged. Secrets (session keys) come from environment/config, never
hard-coded in the repository.

### V. Auditability & Safe Defaults
Security-relevant events (login success/failure, role changes, user
creation/deletion, sensitive-data access grants) MUST be recorded. Destructive
or privilege-changing actions require an authenticated admin. The system fails
closed: on any doubt about permission, deny.

## Security Requirements

- Passwords hashed with bcrypt (cost >= 10).
- All mutating routes require an authenticated session; state-changing requests
  are protected against CSRF (same-site cookies and/or token).
- Input validated and parameterized queries used everywhere (no string-built SQL).
- At least one Admin must always exist; the last Admin cannot be demoted or deleted.
- Repeated failed logins are rate-limited / locked out.

## Development Workflow

- Spec-driven: spec -> plan -> tasks -> implement, per GitHub Spec Kit.
- Every authorization rule in the spec maps to a server-side check and a test.
- Changes to roles/permissions require updating this constitution's role matrix.

## Governance

This constitution supersedes convenience and aesthetics. Any code that would
send unauthorized data to a client, store a password in the clear, or move an
access decision to the browser violates the constitution and must be rejected in
review. Complexity added for security is justified by default; complexity added
elsewhere must earn its place.

**Version**: 1.0.0 | **Ratified**: 2026-08-09 | **Last Amended**: 2026-08-09
