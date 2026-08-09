// First-run seeding: create the initial Admin from environment variables and
// two sample members. Idempotent — safe to run repeatedly. (FR-002, assumptions)
import bcrypt from 'bcryptjs';
import db from './db.js';

const BCRYPT_COST = 12;

export function seed({ log = console.log } = {}) {
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD;

  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount === 0) {
    if (!adminPass) {
      throw new Error(
        'No users exist and ADMIN_PASSWORD is not set. Set ADMIN_USERNAME/ADMIN_PASSWORD in your environment (.env) and re-run seeding.'
      );
    }
    const hash = bcrypt.hashSync(adminPass, BCRYPT_COST);
    db.prepare(
      'INSERT INTO users (username, password_hash, role, active) VALUES (?, ?, ?, 1)'
    ).run(adminUser, hash, 'admin');
    log(`Created initial admin user: ${adminUser}`);
  } else {
    log('Users already exist; skipping admin creation.');
  }

  const memberCount = db.prepare('SELECT COUNT(*) AS n FROM members').get().n;
  if (memberCount === 0) {
    const insert = db.prepare(
      'INSERT INTO members (name, title, department, phone, salary) VALUES (?, ?, ?, ?, ?)'
    );
    insert.run('Alice Johnson', 'Engineer', 'Product', '+1 555 123 4567', '$120,000');
    insert.run('Bob Smith', 'Designer', 'Product', '+1 555 987 6543', '$110,000');
    log('Inserted 2 sample members.');
  } else {
    log('Members already exist; skipping sample data.');
  }
}

// Allow running directly: `npm run seed`
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    seed();
    console.log('Seeding complete.');
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  }
}
