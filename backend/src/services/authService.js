const userRepository = require("../repositories/userRepository");
const { assertValidUsername, normalizeUsername } = require("../validators/usernameValidator");
const { hashPassword, verifyPassword } = require("../utils/password");
const { signJwt, verifyJwt } = require("../utils/jwt");
const syncService = require("./syncService");
const { sendResetEmail } = require("../utils/email");

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

    if (!email || typeof email !== "string" || !email.includes("@")) {
      const error = new Error("A valid email address is required.");
      error.status = 400;
      throw error;
    }

    if (await userRepository.findByUsername(normalized)) {
      const error = new Error("Username is already taken.");
      error.status = 409;
      throw error;
    }

    const emailNormalized = email.trim().toLowerCase();
    if (await userRepository.findByEmail(emailNormalized)) {
      const error = new Error("Email address is already in use.");
      error.status = 409;
      throw error;
    }

    const user = await userRepository.create({
      username: normalized,
      email: emailNormalized,
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

  async forgotPassword({ email, req }) {
    if (!email || !email.includes("@")) {
      const error = new Error("Please provide a valid email address.");
      error.status = 400;
      throw error;
    }

    const user = await userRepository.findByEmail(email.trim().toLowerCase());
    if (!user) {
      const error = new Error("No account found with this email address.");
      error.status = 404;
      throw error;
    }

    // Generate token valid for 15 minutes (900 seconds)
    const token = signJwt({ email: user.email }, 900);
    const resetHost = `${req.protocol}://${req.get("host")}`;
    const resetLink = `${resetHost}/auth/reset-password-page?token=${token}`;

    await sendResetEmail(user.email, resetLink);

    return { success: true, message: "Reset instructions sent successfully.", resetLink };
  },

  async resetPassword({ token, password }) {
    if (!token) {
      const error = new Error("Invalid or missing token.");
      error.status = 400;
      throw error;
    }

    if (!password || password.length < 6) {
      const error = new Error("Password must be at least 6 characters.");
      error.status = 400;
      throw error;
    }

    const decoded = verifyJwt(token);
    if (!decoded || !decoded.email) {
      const error = new Error("Token is invalid or expired.");
      error.status = 400;
      throw error;
    }

    const user = await userRepository.findByEmail(decoded.email);
    if (!user) {
      const error = new Error("User not found.");
      error.status = 404;
      throw error;
    }

    const hashedPassword = hashPassword(password);
    await userRepository.updateByUsername(user.username, { password_hash: hashedPassword });

    return { success: true, message: "Password updated successfully." };
  },
};
