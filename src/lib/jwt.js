import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

export function signAccessToken(userId) {
  return jwt.sign({ sub: userId }, ACCESS_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(userId) {
  return jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: "30d" });
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, ACCESS_SECRET);
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, REFRESH_SECRET);
  } catch {
    return null;
  }
}
