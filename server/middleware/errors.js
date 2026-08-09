// Central error handler. Never leaks internals or sensitive values to clients
// or logs (Constitution: Principle III & V, FR-013).

export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found.' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  // Log a generic, scrubbed message server-side. Do not log request bodies,
  // which may contain sensitive field values.
  const safeMessage = err?.publicMessage || 'Internal server error.';
  console.error(`[error] ${err?.code || 'ERR'}: ${err?.message || 'unknown'}`);
  const status = Number.isInteger(err?.status) ? err.status : 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error.' : safeMessage });
}

// Helper to throw an error the handler will surface with a chosen status/message.
export function httpError(status, publicMessage) {
  const e = new Error(publicMessage);
  e.status = status;
  e.publicMessage = publicMessage;
  return e;
}
