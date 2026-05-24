const entityRepository = require("../repositories/entityRepository");
const { SyncLog } = require("../models/EntityModels");

const lwwSort = (a, b) => {
  const versionDelta = (b.version || 0) - (a.version || 0);
  if (versionDelta !== 0) return versionDelta;
  return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
};

module.exports = {
  async universalSync(username, { changes = [], since = null, collections = entityRepository.collections, tracking = null }) {
    const grouped = new Map();
    for (const change of changes) {
      if (!change.entity || !change.collection) continue;
      if (!grouped.has(change.collection)) grouped.set(change.collection, []);
      grouped.get(change.collection).push(change.entity);
    }

    let pushed = 0;
    for (const [collection, entities] of grouped.entries()) {
      const deduped = Object.values(
        entities.reduce((acc, entity) => {
          const existing = acc[entity.id];
          acc[entity.id] = !existing ? entity : [existing, entity].sort(lwwSort)[0];
          return acc;
        }, {})
      );
      pushed += deduped.length;
      await entityRepository.bulkUpsert(collection, username, deduped);
    }

    const updates = {};
    for (const collection of collections) {
      updates[collection] = await entityRepository.findUpdatedSince(collection, username, since);
    }

    await SyncLog.create({
      id: `sync_${Date.now()}`,
      user_id: username,
      updated_at: new Date().toISOString(),
      payload: { pushed, pulled: Object.values(updates).reduce((sum, list) => sum + list.length, 0), tracking },
      sync_status: "synced",
    });

    return { ok: true, pushed, updates };
  },

  async getBackup(username) {
    const backup = {};
    for (const collection of entityRepository.collections) {
      backup[collection] = await entityRepository.findAll(collection, username);
    }
    return backup;
  },

  async cascadeUserId(oldUserId, newUserId) {
    await entityRepository.cascadeUserId(oldUserId, newUserId);
  },
};
