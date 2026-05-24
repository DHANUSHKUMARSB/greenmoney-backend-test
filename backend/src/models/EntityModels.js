const mongoose = require("mongoose");

const entitySchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    user_id: { type: String, required: true, index: true },
    account_id: String,
    category_id: String,
    type: String,
    amount: Number,
    name: String,
    note: String,
    description: String,
    date: String,
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    created_at: String,
    updated_at: { type: String, required: true, index: true },
    deleted_at: String,
    sync_status: String,
    version: { type: Number, default: 1 },
    device_id: String,
  },
  { timestamps: true, strict: false }
);

entitySchema.index({ user_id: 1, id: 1 }, { unique: true });
entitySchema.index({ user_id: 1, updated_at: -1 });

const makeModel = (name, collection) =>
  mongoose.models[name] || mongoose.model(name, entitySchema, collection);

module.exports = {
  Transaction: makeModel("Transaction", "transactions"),
  Account: makeModel("Account", "accounts"),
  Budget: makeModel("Budget", "budgets"),
  Goal: makeModel("Goal", "goals"),
  Setting: makeModel("Setting", "settings"),
  Category: makeModel("Category", "categories"),
  Recurring: makeModel("Recurring", "recurring"),
  SyncLog: makeModel("SyncLog", "sync_logs"),
  AppVersion: makeModel("AppVersion", "app_versions"),
};
