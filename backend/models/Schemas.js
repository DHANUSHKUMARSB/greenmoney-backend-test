const mongoose = require("mongoose");

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  user_id: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, default: "" },
  date: { type: String, required: true },
  version: { type: Number, default: 1 },
  updated_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, default: null }
}, { timestamps: true, strict: false });

transactionSchema.index({ id: 1, user_id: 1 }, { unique: true });
transactionSchema.index({ user_id: 1 });
transactionSchema.index({ updated_at: -1 });

// Profile/Settings Schema
const profileSchema = new mongoose.Schema({
  user_id: { type: String, required: true, unique: true },
  username: { type: String, default: "" },
  settings: { type: Object, default: {} },
  categories: Array,
  accounts: Array,
  last_sync: { type: Date, default: Date.now }
}, { timestamps: true, strict: false });

profileSchema.index({ user_id: 1 });

// Generic Schema for simple data structures
const genericSchema = new mongoose.Schema({
  id: { type: String, required: true },
  user_id: { type: String, required: true },
}, { strict: false, timestamps: true });

genericSchema.index({ id: 1, user_id: 1 }, { unique: true });
genericSchema.index({ user_id: 1 });

module.exports = {
  transactionSchema,
  profileSchema,
  genericSchema
};
