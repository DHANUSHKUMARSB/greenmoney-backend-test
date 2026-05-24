const express = require("express");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const { connectDB } = require("./utils/database");
const authRoutes = require("./routes/auth");
const syncRoutes = require("./routes/sync");
const appVersionRoutes = require("./routes/appVersion");
const errorHandler = require("./middleware/errorHandler");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }));

app.get("/", (_req, res) => res.json({ status: "GreenMoney backup backend alive" }));
app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
app.use("/auth", authRoutes);
app.use("/sync", syncRoutes);
app.use("/app-version", appVersionRoutes);
app.use(errorHandler);

const port = process.env.PORT || 3000;
connectDB().then(() => {
  app.listen(port, "0.0.0.0", () => {
    console.log(`[BACKEND] GreenMoney backup backend listening on ${port}`);
  });
});
