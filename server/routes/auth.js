// Authentication routes: login, logout, me. (FR-001..004)
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { capabilitiesFor } from '../permissions.js';
import { recordEvent } from '../audit.js';

const router = Router();

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

function getAttempt(username) {
  return db.prepare('SELECT * FROM login_attempts WHERE username = ?').get(username);
}
function isLocked(attempt) {
  if (!attempt?.locked_until) return false;
  return new Date(attempt.locked_until).getTime() > Date.now();
}
function registerFailure(username) {
  const a = getAttempt(username);
  const fails = (a?.fail_count || 0) + 1;
  let lockedUntil = null;
  if (fails >= MAX_FAILS) {
    lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
  }
  db.prepare(
    `INSERT INTO login_attempts (username, fail_count, locked_until)
     VALUES (?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET fail_count = excluded.fail_count, locked_until = excluded.locked_until`
  ).run(username, fails, lockedUntil);
}
function clearFailures(username) {
  db.prepare('DELETE FROM login_attempts WHERE username = ?').run(username);
}

// POST /api/login  { username, password }
router.post('/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const attempt = getAttempt(username);
  if (isLocked(attempt)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  // Always run a bcrypt compare to reduce username-enumeration timing differences.
  const hash = user?.password_hash || '$2a$12$0000000000000000000000000000000000000000000000000000';
  const ok = bcrypt.compareSync(password, hash);

  if (!user || !user.active || !ok) {
    registerFailure(username);
    recordEvent(user?.id ?? null, 'login_failure', `username=${username}`);
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  clearFailures(username);
  // Prevent session fixation: regenerate on privilege change.
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not start session.' });
    req.session.userId = user.id;
    recordEvent(user.id, 'login_success', `username=${username}`);
    res.json({
      user: { id: user.id, username: user.username, role: user.role },
      capabilities: capabilitiesFor(user.role),
    });
  });
});

// POST /api/logout
router.post('/logout', (req, res) => {
  const uid = req.session?.userId;
  req.session.destroy(() => {
    if (uid) recordEvent(uid, 'logout', '');
    res.clearCookie('sid');
    res.json({ ok: true });
  });
});

// GET /api/me  -> current user + capabilities, or 401
router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  res.json({
    user: { id: req.user.id, username: req.user.username, role: req.user.role },
    capabilities: capabilitiesFor(req.user.role),
  });
});

export default router;
