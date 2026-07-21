// import { verifyAccessToken } from "../lib/jwt.js";
// import { unauthorized } from "../lib/response.js";

// /**
//  * Protects a route: requires a valid `Authorization: Bearer <token>` header.
//  * On success, sets req.userId and calls next(). On failure, responds 401 directly.
//  * Usage: router.get("/profile", requireAuth, handler)
//  */
// export function requireAuth(req, res, next) {
//   const header = req.headers.authorization || "";
//   console.log("Authorization Header:", header);
//   const token = header.startsWith("Bearer ") ? header.slice(7) : null;
//   if (!token) return unauthorized(res);

//   console.log("Token:", token);

//   if (!token) {
//     console.log("No token");
//     return unauthorized(res);
//   }

//   const payload = verifyAccessToken(token);
//   if (!payload) return unauthorized(res);

//   req.userId = payload.sub;
//   next();
// }
import { verifyAccessToken } from "../lib/jwt.js";
import { unauthorized } from "../lib/response.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";

  console.log("Authorization Header:", header);

  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  console.log("Token:", token);

  if (!token) {
    console.log("No token");
    return unauthorized(res);
  }

  const payload = verifyAccessToken(token);

  console.log("Payload:", payload);

  if (!payload) {
    console.log("Invalid Token");
    return unauthorized(res);
  }

  req.userId = payload.sub;

  next();
}
