const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const normalizeUsername = (username) => String(username || "").trim().toLowerCase();

const assertValidUsername = (username) => {
  const normalized = normalizeUsername(username);
  if (!USERNAME_RE.test(normalized)) {
    const error = new Error("Username must be 3-20 lowercase letters, numbers, or underscores.");
    error.status = 400;
    throw error;
  }
  return normalized;
};

module.exports = { normalizeUsername, assertValidUsername };
