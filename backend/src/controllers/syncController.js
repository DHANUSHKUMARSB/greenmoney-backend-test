const syncService = require("../services/syncService");

module.exports = {
  universalSync: async (req, res, next) => {
    try {
      res.json(await syncService.universalSync(req.user.username, req.body));
    } catch (error) {
      next(error);
    }
  },

  backup: async (req, res, next) => {
    try {
      res.json(await syncService.getBackup(req.user.username));
    } catch (error) {
      next(error);
    }
  },
};
