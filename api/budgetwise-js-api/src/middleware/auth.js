import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Middleware for optional authentication
export async function optionalAuth(req, _res, next) {
  // Get Authorization header
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);

  // If no token, set req.user to null and continue
  if (!m) {
    req.user = null;
    return next();
  }

  try {
    // Verify JWT token
    const payload = jwt.verify(m[1], process.env.JWT_SECRET || "dev_secret");

    // Find user by ID from token, or create if not found
    let user = await User.findByPk(payload.sub);
    if (!user) {
      user = await User.create({
        id: payload.sub,
        email: payload.email || "unknown@example.com",
        passwordHash: null // passwordHash can be null
      });
      console.log("[auth] created user automatically:", user.id);
    }

    // Attach user info to request
    req.user = { id: user.id, email: user.email };
  } catch (err) {
    // If token invalid, log error and set req.user to null
    console.error("[auth] Token error:", err.message);
    req.user = null;
  }

  next(); // Continue to next middleware/route
}