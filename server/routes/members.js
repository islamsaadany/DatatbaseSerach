// Member directory routes: role-scoped read, plus create/edit/delete per role.
// (FR-007..013, FR-019)
import { Router } from 'express';
import db from '../db.js';
import { can, serializeMember } from '../permissions.js';
import { requireAuth, requireCapability } from '../middleware/auth.js';
import { recordEvent } from '../audit.js';

const router = Router();

// All member routes require authentication.
router.use(requireAuth);

// GET /api/members?q=  -> role-scoped list. Phone is searchable only by roles
// that can view it (searchByPhone), so lower roles cannot probe phone numbers.
router.get('/', (req, res) => {
  const role = req.user.role;
  const q = String(req.query.q || '').trim().toLowerCase();

  const rows = db.prepare('SELECT * FROM members ORDER BY name COLLATE NOCASE').all();

  let filtered = rows;
  if (q) {
    const digits = q.replace(/\s+/g, '');
    filtered = rows.filter((m) => {
      if (m.name.toLowerCase().includes(q)) return true;
      if (can(role, 'searchByPhone') && m.phone) {
        return m.phone.replace(/\s+/g, '').includes(digits);
      }
      return false;
    });
  }

  res.json(filtered.map((m) => serializeMember(m, role)));
});

// POST /api/members  (member + admin). Only admin may set sensitive fields.
router.post('/', requireCapability('createMember'), (req, res) => {
  const role = req.user.role;
  const name = String(req.body?.name || '').trim();
  const title = req.body?.title ? String(req.body.title).trim() : null;
  const department = req.body?.department ? String(req.body.department).trim() : null;
  if (!name) return res.status(400).json({ error: 'Name is required.' });

  // Sensitive fields accepted only from roles allowed to edit them.
  const phone = can(role, 'editSensitive') && req.body?.phone ? String(req.body.phone).trim() : null;
  const salary = can(role, 'editSensitive') && req.body?.salary ? String(req.body.salary).trim() : null;

  const info = db
    .prepare('INSERT INTO members (name, title, department, phone, salary) VALUES (?, ?, ?, ?, ?)')
    .run(name, title, department, phone, salary);
  const created = db.prepare('SELECT * FROM members WHERE id = ?').get(info.lastInsertRowid);
  recordEvent(req.user.id, 'member_create', `id=${created.id}`);
  res.status(201).json(serializeMember(created, role));
});

// PUT /api/members/:id  (member + admin). Sensitive fields writable only by admin.
router.put('/:id', requireCapability('editMember'), (req, res) => {
  const role = req.user.role;
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Member not found.' });

  const name = req.body?.name != null ? String(req.body.name).trim() : existing.name;
  if (!name) return res.status(400).json({ error: 'Name cannot be empty.' });
  const title = req.body?.title != null ? String(req.body.title).trim() : existing.title;
  const department = req.body?.department != null ? String(req.body.department).trim() : existing.department;

  // Non-admins cannot change sensitive fields; keep the stored values.
  let phone = existing.phone;
  let salary = existing.salary;
  if (can(role, 'editSensitive')) {
    if (req.body?.phone != null) phone = String(req.body.phone).trim();
    if (req.body?.salary != null) salary = String(req.body.salary).trim();
  }

  db.prepare(
    'UPDATE members SET name = ?, title = ?, department = ?, phone = ?, salary = ? WHERE id = ?'
  ).run(name, title, department, phone, salary, id);
  const updated = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  recordEvent(req.user.id, 'member_update', `id=${id}`);
  res.json(serializeMember(updated, role));
});

// DELETE /api/members/:id  (admin only)
router.delete('/:id', requireCapability('deleteMember'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM members WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Member not found.' });
  db.prepare('DELETE FROM members WHERE id = ?').run(id);
  recordEvent(req.user.id, 'member_delete', `id=${id}`);
  res.json({ ok: true });
});

export default router;
