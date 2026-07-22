import crypto from "crypto";

function isPasswordHash(password) {
  return (
    typeof password === "string" &&
    password.startsWith("scrypt$") &&
    password.split("$").length === 3
  );
}

export function verifyPassword(password, storedPassword) {
  if (!storedPassword) return false;

  // Plain text password (for old accounts)
  if (!isPasswordHash(storedPassword)) {
    return String(password) === String(storedPassword);
  }

  const [, salt, key] = storedPassword.split("$");

  if (!salt || !key) return false;

  const storedKey = Buffer.from(key, "hex");
  const derivedKey = crypto.scryptSync(
    String(password),
    salt,
    storedKey.length
  );

  return (
    storedKey.length === derivedKey.length &&
    crypto.timingSafeEqual(storedKey, derivedKey)
  );
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}
