import User from "../models/User.js";
import { verifyPassword } from "./password.js";

export async function verifyAdminPassword(userId, password) {
  if (!password) return false;

  const adminUser = await User.findOne({
    _id: userId,
    role: { $in: ["ceo_founder"] },
  }).select("+password");

  if (!adminUser || !adminUser.password) {
    return false;
  }

  return await verifyPassword(password, adminUser.password);
}