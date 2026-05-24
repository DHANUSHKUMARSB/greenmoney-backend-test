const authService = require("../services/authService");
const userRepository = require("../repositories/userRepository");
const { assertValidUsername } = require("../validators/usernameValidator");

module.exports = {
  register: async (req, res, next) => {
    try {
      res.json(await authService.register(req.body));
    } catch (error) {
      next(error);
    }
  },

  login: async (req, res, next) => {
    try {
      res.json(await authService.login(req.body));
    } catch (error) {
      next(error);
    }
  },

  checkUsername: async (req, res, next) => {
    try {
      const username = assertValidUsername(req.params.username);
      res.json({ available: !(await userRepository.findByUsername(username)) });
    } catch (error) {
      next(error);
    }
  },

  updateUsername: async (req, res, next) => {
    try {
      res.json(await authService.updateUsername(req.user.username, req.body.username));
    } catch (error) {
      next(error);
    }
  },

  updateProfileImage: async (req, res, next) => {
    try {
      res.json(await authService.updateProfileImage(req.user.username, req.body.profileImage));
    } catch (error) {
      next(error);
    }
  },
};
