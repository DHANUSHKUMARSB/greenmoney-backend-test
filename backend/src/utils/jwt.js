const crypto = require("crypto");

const base64url = (input) =>
  Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

const decodeBase64url = (input) => {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
};

const signJwt = (payload, expiresInSeconds = 60 * 60 * 24 * 30) => {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
  const signature = crypto.createHmac("sha256", secret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
};

const verifyJwt = (token) => {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) throw new Error("Invalid token");
  const expected = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Invalid token signature");
  }
  const decoded = JSON.parse(decodeBase64url(payload));
  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) throw new Error("Token expired");
  return decoded;
};

module.exports = { signJwt, verifyJwt };
