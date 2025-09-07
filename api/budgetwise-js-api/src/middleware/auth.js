import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function optionalAuth(req, _res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);

  if (!m) {
    req.user = null; // אין טוקן
    return next();
  }

  try {
    const payload = jwt.verify(m[1], process.env.JWT_SECRET || "dev_secret");

    // נוודא שהמשתמש קיים ב־DB, ואם לא – ניצור אותו
    let user = await User.findByPk(payload.sub);
    if (!user) {
      user = await User.create({
        id: payload.sub,
        email: payload.email || "unknown@example.com",
        passwordHash: null   // מאפשר כי passwordHash מוגדר nullable
      });
      console.log("[auth] created user automatically:", user.id);
    }

    req.user = { id: user.id, email: user.email };
  } catch (err) {
    console.error("[auth] Token error:", err.message);
    req.user = null; // טוקן לא תקין
  }

  next();
}
