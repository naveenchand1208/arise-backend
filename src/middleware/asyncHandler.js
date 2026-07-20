/**
 * Wraps an async Express route handler so thrown errors / rejected promises
 * are forwarded to the global error-handling middleware instead of crashing
 * the process or hanging the request.
 *
 * Usage: router.get("/", asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
