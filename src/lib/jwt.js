import jwt from "jsonwebtoken";

// const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
// const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
// console.log("ACCESSSEChhhRET:", ACCESS_SECRET);
// console.log("REFRESHddSECRET:", REFRESH_SECRET);

export function signAccessToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: "30d" });
}

// export function verifyAccessToken(token) {
//   try {
//     return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
//   } catch {
//     return null;
//   }
// }
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return null;
  }
}
