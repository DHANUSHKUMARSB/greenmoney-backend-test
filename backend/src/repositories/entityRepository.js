const models = require("../models/EntityModels");

const MODEL_BY_COLLECTION = {
  transactions: models.Transaction,
  accounts: models.Account,
  budgets: models.Budget,
  goals: models.Goal,
  settings: models.Setting,
  categories: models.Category,
  recurring: models.Recurring,
};

const serialize = (doc) => {
  const object = doc.toObject ? doc.toObject() : doc;
  const { _id, __v, payload, ...rest } = object;
  return { ...(payload || {}), ...rest };
};

module.exports = {
  collections: Object.keys(MODEL_BY_COLLECTION),

  modelFor(collection) {
    const model = MODEL_BY_COLLECTION[collection];
    if (!model) {
      const error = new Error(`Unsupported collection: ${collection}`);
      error.status = 400;
      throw error;
    }
    return model;
  },

  async bulkUpsert(collection, userId, entities) {
    const Model = this.modelFor(collection);
    if (!entities.length) return;
    await Model.bulkWrite(
      entities.map((entity) => ({
        updateOne: {
          filter: { user_id: userId, id: entity.id },
          update: {
            $set: {
              ...entity,
              user_id: userId,
              payload: entity,
              sync_status: entity.deleted_at ? "deleted" : "synced",
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  },

  async findAll(collection, userId) {
    const Model = this.modelFor(collection);
    const docs = await Model.find({ user_id: userId }).lean();
    return docs.map(serialize);
  },

  async findUpdatedSince(collection, userId, since) {
    const Model = this.modelFor(collection);
    const query = since ? { user_id: userId, updated_at: { $gt: since } } : { user_id: userId };
    const docs = await Model.find(query).lean();
    return docs.map(serialize);
  },

  async cascadeUserId(oldUserId, newUserId) {
    await Promise.all(
      this.collections.map((collection) =>
        this.modelFor(collection).updateMany({ user_id: oldUserId }, { $set: { user_id: newUserId } })
      )
    );
  },
};
