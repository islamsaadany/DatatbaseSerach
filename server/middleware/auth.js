// Authentication & authorization middleware. Deny by default. (FR-001,006,010)
import db from '../db.js';
import { can } from '../permissions.js';

// Loads the current user (if any) from the session onto req.user.
// Re-reads the DB each request so role/active changes take effect immediately
// (FR-015: role change applies on next request).
export function loadUser(req, _res, next) {
  req.user = null;
  const userId = req.session?.userId;
  if (userId) {
    const user = db
      .prepare('SELECT id, username, role, active FROM users WHERE id = ?')
      .get(userId);
    if (user && user.active) {
      req.user = user;
    } else {
      // Account gone or deactivated -> drop the session.
      req.session.destroy(() => {});
    }
  }
  next();
}

// Wall for API routes: 401 JSON when unauthenticated.
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  next();
}

// Wall for HTML pages: redirect to login when unauthenticated.
export function requireAuthPage(req, res, next) {
  if (!req.user) return res.redirect('/login.html');
  next();
}

// Require that the current user's role has ALL of the given capabilities.
export function requireCapability(...capabilities) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    const ok = capabilities.every((c) => can(req.user.role, c));
    if (!ok) return res.status(403).json({ error: 'You do not have permission to do that.' });
    next();
  };
}
