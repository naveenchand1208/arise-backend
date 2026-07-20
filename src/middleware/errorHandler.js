// Express recognizes this as error-handling middleware because it has 4 params.
// Must be registered LAST, after all routes, in server.js.
export function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
}

// Catches requests to unknown routes.
export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: "Route not found" });
}
