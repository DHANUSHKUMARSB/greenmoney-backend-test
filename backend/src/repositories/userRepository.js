const User = require("../models/User");

module.exports = {
  findByUsername: (username) => User.findOne({ username }),
  findByEmail: (email) => User.findOne({ email }),
  create: (data) => User.create(data),
  updateByUsername: (username, updates) => User.findOneAndUpdate({ username }, updates, { new: true }),
};
