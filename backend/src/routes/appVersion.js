const router = require("express").Router();
const appVersionController = require("../controllers/appVersionController");

router.get("/", appVersionController.getVersion);

module.exports = router;
