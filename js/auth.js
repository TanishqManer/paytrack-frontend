const jwt = require("jsonwebtoken");

/**
 * protect — Express middleware
 * Reads the JWT from Authorization: Bearer <token>
 * Attaches req.userId for downstream route handlers
 */
function protect(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided. Please log in.",
    });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    const message =
      err.name === "TokenExpiredError"
        ? "Session expired. Please log in again."
        : "Invalid token. Please log in.";

    return res.status(401).json({ success: false, message });
  }
}

/**
 * signToken — generate a signed JWT for a user
 */
function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

module.exports = { protect, signToken };
