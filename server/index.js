// App entry: Express wiring, security headers, sessions, static frontend, routes.
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import './db.js';
import { seed } from './seed.js';
import { loadUser, requireAuthPage } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import memberRoutes from './routes/members.js';
import adminRoutes from './routes/admin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
        },
      },
    })
  );
  app.use(express.json());

  const isProd = process.env.NODE_ENV === 'production';
  app.set('trust proxy', 1);
  app.use(
    session({
      name: 'sid',
      secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,     // JS cannot read the cookie
        sameSite: 'lax',    // CSRF mitigation for cross-site requests
        secure: isProd,     // HTTPS-only in production
        maxAge: 1000 * 60 * 60 * 8, // 8h
      },
    })
  );

  app.use(loadUser);

  // API
  app.use('/api', authRoutes);            // /api/login, /api/logout, /api/me
  app.use('/api/members', memberRoutes);
  app.use('/api/admin', adminRoutes);

  // Protected HTML pages: gate everything except login + assets behind auth.
  app.get(['/', '/index.html'], requireAuthPage, (_req, res) =>
    res.sendFile(join(PUBLIC_DIR, 'index.html'))
  );
  app.get('/admin.html', requireAuthPage, (_req, res) =>
    res.sendFile(join(PUBLIC_DIR, 'admin.html'))
  );

  // Public assets (login page, css, js). These contain no protected data.
  app.use(express.static(PUBLIC_DIR));

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}

// Start the server unless imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    seed();
  } catch (err) {
    console.error('Startup seeding failed:', err.message);
    process.exit(1);
  }
  const app = createApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Team Directory running on http://localhost:${port}`));
}
