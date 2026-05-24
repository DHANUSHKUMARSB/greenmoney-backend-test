const router = require("express").Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/check-username/:username", authController.checkUsername);
router.patch("/username", authMiddleware, authController.updateUsername);
router.patch("/profile-image", authMiddleware, authController.updateProfileImage);

module.exports = router;
