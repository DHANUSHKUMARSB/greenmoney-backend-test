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
  profile_image: { type: String, default: "" },
  settings: { type: Object, default: {} },
  categories: Array,
  accounts: Array,
  last_sync: { type: Date, default: Date.now }
}, { timestamps: true, strict: false });

// Generic Schema for simple data structures
const genericSchema = new mongoose.Schema({
  id: { type: String, required: true },
  user_id: { type: String, required: true },
}, { strict: false, timestamps: true });

genericSchema.index({ id: 1, user_id: 1 }, { unique: true });
genericSchema.index({ user_id: 1 });

// User Registration Tracking Schema
const registeredUserSchema = new mongoose.Schema({
  userNumber: { type: Number, unique: true },
  userId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  accountCreatedDate: String,
  accountCreatedTime: String,
  createdAt: { type: Date, default: Date.now },
  signupPlatform: String,
  appVersion: String,
  rewardEligible: { type: Boolean, default: false }
}, { timestamps: true });

registeredUserSchema.index({ userId: 1 });
registeredUserSchema.index({ email: 1 });
registeredUserSchema.index({ userNumber: 1 });

// Atomic Counter Schema
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence_value: { type: Number, default: 0 }
});

module.exports = {
  transactionSchema,
  profileSchema,
  genericSchema,
  registeredUserSchema,
  counterSchema
};
