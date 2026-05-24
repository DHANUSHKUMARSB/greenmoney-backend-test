const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const syncController = require("../controllers/syncController");

router.use(authMiddleware);
router.post("/universal", syncController.universalSync);
router.get("/backup", syncController.backup);

module.exports = router;
