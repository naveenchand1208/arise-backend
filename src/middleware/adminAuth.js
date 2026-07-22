import Admin from "../models/Admin.js";
import { verifyAdminAccessToken } from "../lib/adminAuth.js";
import { fail, unauthorized } from "../lib/response.js";

const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ["*"],
  ADMIN: ["dashboard:read", "users:read", "users:write", "content:write", "community:moderate", "reports:read", "deletions:read"],
  CONTENT_MANAGER: ["dashboard:read", "content:write", "challenges:write"],
  COMMUNITY_MODERATOR: ["dashboard:read", "community:moderate"],
  SUPPORT: ["dashboard:read", "users:read", "subscriptions:read", "deletions:read"],
};

function hasPermission(admin, permission) {
  const rolePermissions = ROLE_PERMISSIONS[admin.role] || [];
  return (
    rolePermissions.includes("*") ||
    rolePermissions.includes(permission) ||
    admin.permissions?.includes(permission)
  );
}

export async function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return unauthorized(res);

    const payload = verifyAdminAccessToken(token);
    if (!payload) return unauthorized(res);

    const admin = await Admin.findById(payload.sub);
    if (!admin || admin.status !== "active") return unauthorized(res);

    req.admin = admin;
    req.adminId = admin._id.toString();
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdminPermission(permission) {
  return (req, res, next) => {
    if (!req.admin) return unauthorized(res);
    if (!hasPermission(req.admin, permission)) return fail(res, "Admin permission denied", 403);
    next();
  };
}
