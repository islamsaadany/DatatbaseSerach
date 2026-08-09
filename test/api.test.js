// Integration tests for auth, role-scoped members, and the admin section.
// Uses a throwaway SQLite file and a fresh app instance.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Configure env BEFORE importing modules that read it at load time.
const DB_FILE = join(tmpdir(), `td-test-${process.pid}.sqlite`);
process.env.DB_PATH = DB_FILE;
process.env.SESSION_SECRET = 'test-secret';
process.env.ADMIN_USERNAME = 'root';
process.env.ADMIN_PASSWORD = 'rootpass123';
process.env.NODE_ENV = 'test';

function cleanup() {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    try { rmSync(DB_FILE + suffix, { force: true }); } catch { /* ignore */ }
  }
}
cleanup();

const request = (await import('supertest')).default;
const { createApp } = await import('../server/index.js');
const { seed } = await import('../server/seed.js');

let app;

before(() => {
  seed({ log: () => {} });
  app = createApp();
});

after(() => cleanup());

// Helper: sign in and return an agent with the session cookie.
async function loginAs(username, password) {
  const agent = request.agent(app);
  const res = await agent.post('/api/login').send({ username, password });
  assert.equal(res.status, 200, `login for ${username} should succeed`);
  return agent;
}

// --- Authentication ---

test('unauthenticated request to members API is rejected', async () => {
  const res = await request(app).get('/api/members');
  assert.equal(res.status, 401);
  assert.ok(!Array.isArray(res.body));
});

test('bad credentials are rejected', async () => {
  const res = await request(app).post('/api/login').send({ username: 'root', password: 'wrong' });
  assert.equal(res.status, 401);
});

test('admin can log in and /api/me reports role', async () => {
  const agent = await loginAs('root', 'rootpass123');
  const me = await agent.get('/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.role, 'admin');
  assert.equal(me.body.capabilities.viewSensitive, true);
});

// --- Admin creates users for the other roles ---

test('admin creates member and viewer users', async () => {
  const admin = await loginAs('root', 'rootpass123');
  const m = await admin.post('/api/admin/users').send({ username: 'mem', password: 'member123', role: 'member' });
  assert.equal(m.status, 201);
  const v = await admin.post('/api/admin/users').send({ username: 'view', password: 'viewer123', role: 'viewer' });
  assert.equal(v.status, 201);
  // No password hash leaks in the response.
  assert.ok(!('password_hash' in m.body));
});

// --- Role-scoped member visibility ---

test('member API omits sensitive fields for member and viewer', async () => {
  const member = await loginAs('mem', 'member123');
  const list = await member.get('/api/members');
  assert.equal(list.status, 200);
  assert.ok(list.body.length >= 2);
  for (const row of list.body) {
    assert.ok(!('phone' in row), 'phone must be absent for member');
    assert.ok(!('salary' in row), 'salary must be absent for member');
  }

  const viewer = await loginAs('view', 'viewer123');
  const vlist = await viewer.get('/api/members');
  for (const row of vlist.body) {
    assert.ok(!('phone' in row) && !('salary' in row));
  }
});

test('member API includes sensitive fields for admin', async () => {
  const admin = await loginAs('root', 'rootpass123');
  const list = await admin.get('/api/members');
  assert.ok(list.body.some((r) => 'phone' in r && 'salary' in r));
});

// --- Action authorization (server-enforced, bypassing UI) ---

test('viewer cannot create or delete members', async () => {
  const viewer = await loginAs('view', 'viewer123');
  const create = await viewer.post('/api/members').send({ name: 'Hax' });
  assert.equal(create.status, 403);
  const del = await viewer.delete('/api/members/1');
  assert.equal(del.status, 403);
});

test('member can add but cannot set salary, and cannot delete', async () => {
  const member = await loginAs('mem', 'member123');
  const create = await member.post('/api/members').send({ name: 'Carol', phone: '+1 555 000 0000', salary: '$999k' });
  assert.equal(create.status, 201);
  assert.ok(!('salary' in create.body) && !('phone' in create.body), 'member response has no sensitive fields');

  // Verify via admin that the sensitive fields the member tried to set were ignored.
  const admin = await loginAs('root', 'rootpass123');
  const list = await admin.get('/api/members?q=Carol');
  const carol = list.body.find((m) => m.name === 'Carol');
  assert.ok(carol);
  assert.equal(carol.phone ?? null, null, 'member must not be able to set phone');
  assert.equal(carol.salary ?? null, null, 'member must not be able to set salary');

  const del = await member.delete('/api/members/' + carol.id);
  assert.equal(del.status, 403);
});

test('member cannot search by phone', async () => {
  const admin = await loginAs('root', 'rootpass123');
  // Alice has phone +1 555 123 4567
  const member = await loginAs('mem', 'member123');
  const res = await member.get('/api/members?q=5551234567');
  assert.equal(res.body.length, 0, 'member phone search must return nothing');
  const adminRes = await admin.get('/api/members?q=5551234567');
  assert.ok(adminRes.body.some((m) => m.name.startsWith('Alice')), 'admin can search by phone');
});

// --- Admin section authorization ---

test('non-admin cannot reach admin endpoints', async () => {
  const member = await loginAs('mem', 'member123');
  const res = await member.get('/api/admin/users');
  assert.equal(res.status, 403);
  const create = await member.post('/api/admin/users').send({ username: 'x', password: 'password1', role: 'admin' });
  assert.equal(create.status, 403);
});

test('role change takes effect and last-admin is protected', async () => {
  const admin = await loginAs('root', 'rootpass123');
  const users = await admin.get('/api/admin/users');
  const rootUser = users.body.find((u) => u.username === 'root');

  // Cannot demote the only admin.
  const demote = await admin.put('/api/admin/users/' + rootUser.id).send({ role: 'member' });
  assert.equal(demote.status, 409);

  // Cannot delete the only admin.
  const del = await admin.delete('/api/admin/users/' + rootUser.id);
  assert.equal(del.status, 409);

  // Promote 'mem' to admin, then demoting root is allowed.
  const memUser = users.body.find((u) => u.username === 'mem');
  const promote = await admin.put('/api/admin/users/' + memUser.id).send({ role: 'admin' });
  assert.equal(promote.status, 200);
  assert.equal(promote.body.role, 'admin');
});
