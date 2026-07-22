import jwt from "jsonwebtoken";

const ADMIN_ACCESS_TOKEN_TTL = "8h";

function adminSecret() {
  return process.env.ADMIN_JWT_SECRET || process.env.JWT_ACCESS_SECRET;
}

export function signAdminAccessToken(admin) {
  return jwt.sign(
    {
      sub: admin._id.toString(),
      email: admin.email,
      role: admin.role,
      kind: "admin",
    },
    adminSecret(),
    { expiresIn: ADMIN_ACCESS_TOKEN_TTL }
  );
}

export function verifyAdminAccessToken(token) {
  try {
    const payload = jwt.verify(token, adminSecret());
    return payload?.kind === "admin" ? payload : null;
  } catch {
    return null;
  }
}
