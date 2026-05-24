const userRepository = require("../repositories/userRepository");
const { assertValidUsername, normalizeUsername } = require("../validators/usernameValidator");
const { hashPassword, verifyPassword } = require("../utils/password");
const { signJwt } = require("../utils/jwt");
const syncService = require("./syncService");

const publicUser = (user) => ({
  username: user.username,
  email: user.email || "",
  profileImage: user.profile_image || null,
  createdAt: user.createdAt,
});

module.exports = {
  async register({ username, password, email }) {
    const normalized = assertValidUsername(username);
    if (!password || password.length < 6) {
      const error = new Error("Password must be at least 6 characters.");
      error.status = 400;
      throw error;
    }

    if (await userRepository.findByUsername(normalized)) {
      const error = new Error("Username is already taken.");
      error.status = 409;
      throw error;
    }

    const user = await userRepository.create({
      username: normalized,
      email: email ? String(email).trim().toLowerCase() : undefined,
      password_hash: hashPassword(password),
    });

    return { token: signJwt({ username: user.username }), user: publicUser(user), backup: await syncService.getBackup(user.username) };
  },

  async login({ usernameOrEmail, password }) {
    const normalized = normalizeUsername(usernameOrEmail);
    const user = usernameOrEmail.includes("@")
      ? await userRepository.findByEmail(String(usernameOrEmail).trim().toLowerCase())
      : await userRepository.findByUsername(normalized);

    if (!user || !verifyPassword(password, user.password_hash)) {
      const error = new Error("Invalid username or password.");
      error.status = 401;
      throw error;
    }

    return { token: signJwt({ username: user.username }), user: publicUser(user), backup: await syncService.getBackup(user.username) };
  },

  async updateUsername(currentUsername, nextUsername) {
    const normalized = assertValidUsername(nextUsername);
    if (await userRepository.findByUsername(normalized)) {
      const error = new Error("Username is already taken.");
      error.status = 409;
      throw error;
    }
    await syncService.cascadeUserId(currentUsername, normalized);
    const user = await userRepository.updateByUsername(currentUsername, { username: normalized });
    return { token: signJwt({ username: user.username }), user: publicUser(user) };
  },

  async updateProfileImage(username, profileImage) {
    const user = await userRepository.updateByUsername(username, { profile_image: profileImage });
    return { user: publicUser(user) };
  },
};
