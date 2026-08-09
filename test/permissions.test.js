// Unit tests for the permission policy — no DB or server needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { can, serializeMember, capabilitiesFor, SENSITIVE_FIELDS } from '../server/permissions.js';

const member = { id: 1, name: 'Alice', title: 'Eng', department: 'Product', phone: '+1 555 111 2222', salary: '$100k' };

test('serializeMember omits sensitive fields for viewer', () => {
  const out = serializeMember(member, 'viewer');
  for (const f of SENSITIVE_FIELDS) assert.ok(!(f in out), `${f} must be absent for viewer`);
  assert.equal(out.name, 'Alice');
});

test('serializeMember omits sensitive fields for member', () => {
  const out = serializeMember(member, 'member');
  for (const f of SENSITIVE_FIELDS) assert.ok(!(f in out), `${f} must be absent for member`);
});

test('serializeMember includes sensitive fields for admin', () => {
  const out = serializeMember(member, 'admin');
  assert.equal(out.phone, '+1 555 111 2222');
  assert.equal(out.salary, '$100k');
});

test('unknown role fails closed', () => {
  assert.equal(can('nope', 'viewMembers'), false);
  const out = serializeMember(member, 'nope');
  assert.ok(!('phone' in out));
});

test('capability matrix matches roles', () => {
  assert.equal(can('viewer', 'createMember'), false);
  assert.equal(can('member', 'createMember'), true);
  assert.equal(can('member', 'deleteMember'), false);
  assert.equal(can('admin', 'deleteMember'), true);
  assert.equal(can('admin', 'adminSection'), true);
  assert.equal(can('member', 'adminSection'), false);
  assert.equal(capabilitiesFor('viewer').viewSensitive, false);
});
