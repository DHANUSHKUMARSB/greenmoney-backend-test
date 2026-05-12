const mongoose = require("mongoose");

const appVersionSchema = new mongoose.Schema({
  latestVersion: { type: String, required: true },
  minimumSupportedVersion: { type: String, required: true },
  apkUrl: { type: String, required: true },
  forceUpdate: { type: Boolean, default: false },
  releaseNotes: [{ type: String }],
  updatedAt: { type: Date, default: Date.now }
});

module.exports = appVersionSchema;
