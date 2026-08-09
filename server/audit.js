// Records security-relevant events (Constitution: Principle V, FR-021).
// `detail` must never contain sensitive field values.
import db from './db.js';

const insert = db.prepare(
  'INSERT INTO audit (actor_id, event, detail) VALUES (?, ?, ?)'
);

export function recordEvent(actorId, event, detail = '') {
  try {
    insert.run(actorId ?? null, event, String(detail).slice(0, 500));
  } catch {
    // Auditing must never break the main flow; swallow storage errors.
  }
}
