const mongoose = require("mongoose");
const path = require("path");
const { getUserDb } = require("./databaseManager");
const { COLLECTION_TYPES } = require("./collectionHelpers");
const { transactionSchema, profileSchema, genericSchema } = require("../models/Schemas");

// Load environment variables
const NODE_ENV = process.env.NODE_ENV || "development";
require('dotenv').config({ path: path.resolve(__dirname, `../.env`) });

const OLD_DB_NAME = NODE_ENV === "production" ? "production" : "test";
let URI = process.env.MONGODB_URI;

// Force override to test database cluster if it still points to the old dev cluster or if none is specified
if (!URI || URI.includes("greenmoneydev.mwqbnor.mongodb.net")) {
  URI = "mongodb+srv://GreenMoneyTest:9788@greenmoneytest.ps3cgtb.mongodb.net/";
}

/**
 * Migration script to move data from shared collections in the 'test'/'production' database
 * into individual, isolated per-user databases.
 */
const migrate = async () => {
  console.log(`🚀 Starting Migration from [${OLD_DB_NAME}] to Isolated Databases...`);
  
  // 1. Connect to the cluster
  await mongoose.connect(URI);
  const oldDb = mongoose.connection.useDb(OLD_DB_NAME);
  console.log(`✅ Connected to source database: ${OLD_DB_NAME}`);

  // 2. Identify all users in the system
  // We can get this from the 'profiles' collection
  const sharedProfiles = oldDb.collection(COLLECTION_TYPES.PROFILE);
  const users = await sharedProfiles.distinct("user_id");
  console.log(`🔍 Found ${users.length} users to migrate.`);

  // 3. Define the collections to migrate
  const collectionsToMigrate = Object.values(COLLECTION_TYPES);

  for (const userId of users) {
    if (!userId) continue;
    console.log(`\n--- Migrating User: ${userId} ---`);
    
    const userDb = await getUserDb(userId);

    for (const collName of collectionsToMigrate) {
      console.log(`  Migrating ${collName}...`);
      
      // Get data from old shared collection for this user
      const sourceData = await oldDb.collection(collName).find({ user_id: userId }).toArray();
      
      if (sourceData.length === 0) {
        console.log(`    (No data found in ${collName})`);
        continue;
      }

      // Determine schema
      let schema = genericSchema;
      if (collName === COLLECTION_TYPES.TRANSACTIONS) schema = transactionSchema;
      if (collName === COLLECTION_TYPES.PROFILE || collName === COLLECTION_TYPES.SETTINGS) schema = profileSchema;

      const modelName = collName.charAt(0).toUpperCase() + collName.slice(0, -1);
      const TargetModel = userDb.model(modelName, schema, collName);

      // Clear target collection first to avoid duplicates if re-run
      await TargetModel.deleteMany({});
      
      // Insert data (without user_id filter dependency for future-proofing, though it's still in the data)
      await TargetModel.insertMany(sourceData);
      console.log(`    ✅ Migrated ${sourceData.length} documents.`);
    }
  }

  console.log("\n✨ Migration completed successfully!");
  process.exit(0);
};

migrate().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
