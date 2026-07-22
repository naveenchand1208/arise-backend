/**
 * Run with: npm run seed:admin
 * Creates or updates an admin login in MongoDB from environment variables.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/mongodb.js";
import { hashPassword } from "../src/lib/password.js";
import Admin, { ADMIN_ROLES } from "../src/models/Admin.js";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function seedAdmin() {
  const name = process.env.ADMIN_NAME?.trim() || "Admin";
  const email = requiredEnv("ADMIN_EMAIL").toLowerCase();
  const password = requiredEnv("ADMIN_PASSWORD");
  const role = process.env.ADMIN_ROLE?.trim() || "SUPER_ADMIN";

  if (!ADMIN_ROLES.includes(role)) {
    throw new Error(`ADMIN_ROLE must be one of: ${ADMIN_ROLES.join(", ")}`);
  }

  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  }

  await connectDB();

  const admin = await Admin.findOneAndUpdate(
    { email },
    {
      $set: {
        name,
        email,
        passwordHash: hashPassword(password),
        role,
        status: "active",
      },
      $setOnInsert: {
        permissions: [],
        lastLoginAt: null,
      },
    },
    { new: true, upsert: true, runValidators: true }
  );

  console.log(`Admin login saved in DB: ${admin.email} (${admin.role})`);
  await mongoose.disconnect();
}

seedAdmin().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
