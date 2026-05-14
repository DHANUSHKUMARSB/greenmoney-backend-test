const mongoose = require("mongoose");

const appVersionSchema = new mongoose.Schema({
  latestVersion: { type: String, required: true },
  minimumSupportedVersion: { type: String, required: true },
  forceUpdate: { type: Boolean, default: false },
  appVersionData: { type: mongoose.Schema.Types.Mixed }, // Flexible map for versions
  apkUrl: { type: String }, // Optional at root, usually in appVersionData
  releaseNotes: [{ type: String }],
  updatedAt: { type: Date, default: Date.now }
});

module.exports = appVersionSchema;

