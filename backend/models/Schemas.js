const mongoose = require("mongoose");

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  local_id: { type: String, required: true },
  user_id: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['income', 'expense', 'transfer'], required: true },
  category: { type: String, required: true },
  description: { type: String, default: "" },
  date: { type: String, required: true },
  version: { type: Number, default: 1 },
  updated_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, default: null }
}, { timestamps: true });

transactionSchema.index({ local_id: 1 }, { unique: true });
transactionSchema.index({ user_id: 1 });
transactionSchema.index({ updated_at: -1 });

// Profile/Settings Schema
const profileSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  username: { type: String, default: "" },
  settings: {
    theme: { type: String, default: 'system' },
    accent_color: { type: String, default: '#2196F3' },
    currency: { type: String, default: 'INR' },
    reminders_enabled: { type: Boolean, default: false },
    reminder_time: { type: String, default: '09:00' },
    pin_enabled: { type: Boolean, default: false }
  },
  categories: Array,
  accounts: Array,
  last_sync: { type: Date, default: Date.now }
}, { timestamps: true });

profileSchema.index({ user_id: 1 });

// Generic Schema for simple data structures (can be expanded later)
const genericSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

module.exports = {
  transactionSchema,
  profileSchema,
  genericSchema
};
