// Central authorization policy. This is the single source of truth for what
// each role may see and do. Enforced server-side (Constitution: Principle I).

export const ROLES = ['viewer', 'member', 'admin'];

// Fields on a member record that are sensitive and must be omitted for roles
// that lack permission (Constitution: Principle III).
export const SENSITIVE_FIELDS = ['phone', 'salary'];

// Capability matrix. can(role, capability) is the only thing routes should ask.
const MATRIX = {
  viewer: {
    viewMembers: true,
    viewSensitive: false,
    searchByPhone: false,
    createMember: false,
    editMember: false,
    editSensitive: false,
    deleteMember: false,
    adminSection: false,
  },
  member: {
    viewMembers: true,
    viewSensitive: false,
    searchByPhone: false,
    createMember: true,
    editMember: true,
    editSensitive: false,
    deleteMember: false,
    adminSection: false,
  },
  admin: {
    viewMembers: true,
    viewSensitive: true,
    searchByPhone: true,
    createMember: true,
    editMember: true,
    editSensitive: true,
    deleteMember: true,
    adminSection: true,
  },
};

export function can(role, capability) {
  const caps = MATRIX[role];
  if (!caps) return false; // unknown role -> deny (fail closed)
  return caps[capability] === true;
}

// Produce the client-facing view of a member for a given role. Sensitive keys
// are OMITTED (not nulled) when the role cannot view them, so they never leave
// the server (Constitution: Principle III).
export function serializeMember(member, role) {
  const out = {
    id: member.id,
    name: member.name,
    title: member.title ?? null,
    department: member.department ?? null,
  };
  if (can(role, 'viewSensitive')) {
    out.phone = member.phone ?? null;
    out.salary = member.salary ?? null;
  }
  return out;
}

// Which capabilities the frontend may use to tailor the UI. This is a
// convenience mirror of the matrix for the client — never a security boundary.
export function capabilitiesFor(role) {
  return { ...(MATRIX[role] || {}) };
}
