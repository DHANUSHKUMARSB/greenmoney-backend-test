const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    email: { type: String, sparse: true, index: true },
    password_hash: { type: String, required: true },
    profile_image: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
