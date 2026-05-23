const mongoose = require("mongoose");
const { registeredUserSchema, counterSchema } = require("../models/Schemas");

let usersDb = null;

const getUsersDb = () => {
  if (!usersDb) {
    usersDb = mongoose.connection.useDb("users", { useCache: true });
  }
  return usersDb;
};

const UserTrackingService = {
  /**
   * Gets the next sequential user number atomically.
   */
  getNextUserNumber: async () => {
    const db = getUsersDb();
    const Counter = db.model("Counter", counterSchema, "counters");

    const result = await Counter.findOneAndUpdate(
      { _id: "userNumber" },
      { $inc: { sequence_value: 1 } },
      { upsert: true, new: true }
    );

    return result.sequence_value;
  },

  /**
   * Registers a user in the tracking system.
   */
  trackUserRegistration: async (userData) => {
    const { userId, email, signupPlatform, appVersion } = userData;
    const db = getUsersDb();
    const RegisteredUser = db.model("RegisteredUser", registeredUserSchema, "registered_users");

    const normalizedEmail = email ? email.trim().toLowerCase() : "";

    // 1. Check for duplicates (case-insensitive check by querying with normalized email)
    const existing = await RegisteredUser.findOne({ 
      $or: [{ userId }, { email: normalizedEmail }] 
    });
    
    if (existing) {
      console.log(`[USER-TRACKING]: User ${userId} already registered in tracking system.`);
      return existing;
    }

    // 2. Get sequential user number
    const userNumber = await UserTrackingService.getNextUserNumber();

    // 3. Format date/time
    const now = new Date();
    const accountCreatedDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const accountCreatedTime = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });

    // 4. Create tracking record
    const newUser = new RegisteredUser({
      userNumber,
      userId,
      email: normalizedEmail,
      accountCreatedDate,
      accountCreatedTime,
      createdAt: now,
      signupPlatform: signupPlatform || "unknown",
      appVersion: appVersion || "1.0.0",
      rewardEligible: userNumber <= 500
    });

    await newUser.save();
    console.log(`[USER-TRACKING]: Registered User #${userNumber}: ${userId} (${normalizedEmail}). Reward: ${newUser.rewardEligible}`);
    
    return newUser;
  },

  /**
   * Gets user statistics.
   */
  getUserStats: async () => {
    const db = getUsersDb();
    const RegisteredUser = db.model("RegisteredUser", registeredUserSchema, "registered_users");

    const totalUsers = await RegisteredUser.countDocuments();
    const founderSlotsRemaining = Math.max(0, 500 - totalUsers);
    const latestSignups = await RegisteredUser.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('userNumber userId accountCreatedDate rewardEligible');

    return {
      totalUsers,
      founderSlotsRemaining,
      latestSignups,
      systemStatus: "operational"
    };
  }
};

module.exports = UserTrackingService;
