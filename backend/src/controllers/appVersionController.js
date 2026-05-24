module.exports = {
  getVersion: (_req, res) => {
    res.json({
      latestVersion: "1.0.0",
      minimumSupportedVersion: "1.0.0",
      forceUpdate: false,
      appVersionData: {},
      updatedAt: new Date().toISOString(),
    });
  },
};
