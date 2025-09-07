import User from "../models/User.js";

export async function ensureUser(userId, email) {
  let user = await User.findByPk(userId);

  if (!user) {
    user = await User.create({
      id: userId,
      email: email || "unknown@example.com"
    });
    console.log(`[auth] Created user automatically: ${userId}`);
  }

  return user;
}
