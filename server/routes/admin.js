// Admin section: user & access management. Admin only. (FR-014..018)
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { ROLES } from '../permissions.js';
import { requireCapability } from '../middleware/auth.js';
import { recordEvent } from '../audit.js';

const router = Router();
const BCRYPT_COST = 12;

// Every route here requires the adminSection capability.
router.use(requireCapability('adminSection'));

function countAdmins() {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n;
}
function publicUser(u) {
  return { id: u.id, username: u.username, role: u.role, active: !!u.active, created_at: u.created_at };
}

// GET /api/admin/users  -> never includes password hashes.
router.get('/users', (_req, res) => {
  const rows = db
    .prepare('SELECT id, username, role, active, created_at FROM users ORDER BY username COLLATE NOCASE')
    .all();
  res.json(rows.map((u) => ({ ...u, active: !!u.active })));
});

// POST /api/admin/users  { username, password, role }
router.post('/users', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const role = String(req.body?.role || '').trim();

  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'That username is already taken.' });

  const hash = bcrypt.hashSync(password, BCRYPT_COST);
  const info = db
    .prepare('INSERT INTO users (username, password_hash, role, active) VALUES (?, ?, ?, 1)')
    .run(username, hash, role);
  const created = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  recordEvent(req.user.id, 'user_create', `id=${created.id} role=${role}`);
  res.status(201).json(publicUser(created));
});

// PUT /api/admin/users/:id  -> change role, active, and/or reset password.
router.put('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const wantsRole = req.body?.role != null ? String(req.body.role).trim() : null;
  const wantsActive = req.body?.active != null ? (req.body.active ? 1 : 0) : null;
  const wantsPassword = req.body?.password != null ? String(req.body.password) : null;

  if (wantsRole != null && !ROLES.includes(wantsRole)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }

  // Last-admin guard: refuse to demote or deactivate the final active admin. (FR-017)
  const demoting = wantsRole != null && user.role === 'admin' && wantsRole !== 'admin';
  const deactivating = wantsActive === 0 && user.role === 'admin' && user.active;
  if ((demoting || deactivating) && countAdmins() <= 1) {
    return res.status(409).json({ error: 'Cannot remove the last remaining admin.' });
  }

  if (wantsPassword != null) {
    if (wantsPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const hash = bcrypt.hashSync(wantsPassword, BCRYPT_COST);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
    recordEvent(req.user.id, 'user_password_reset', `id=${id}`);
  }
  if (wantsRole != null && wantsRole !== user.role) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(wantsRole, id);
    recordEvent(req.user.id, 'user_role_change', `id=${id} ${user.role}->${wantsRole}`);
  }
  if (wantsActive != null && wantsActive !== user.active) {
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(wantsActive, id);
    recordEvent(req.user.id, 'user_active_change', `id=${id} active=${wantsActive}`);
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json(publicUser(updated));
});

// DELETE /api/admin/users/:id  -> last-admin guarded; cannot delete self into zero admins.
router.delete('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  if (user.role === 'admin' && user.active && countAdmins() <= 1) {
    return res.status(409).json({ error: 'Cannot delete the last remaining admin.' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  recordEvent(req.user.id, 'user_delete', `id=${id}`);
  res.json({ ok: true });
});

export default router;
