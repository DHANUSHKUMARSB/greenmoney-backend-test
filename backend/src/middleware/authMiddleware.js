const { verifyJwt } = require("../utils/jwt");

module.exports = (req, _res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      const error = new Error("Missing token");
      error.status = 401;
      throw error;
    }
    req.user = verifyJwt(token);
    next();
  } catch (error) {
    error.status = error.status || 401;
    next(error);
  }
};
