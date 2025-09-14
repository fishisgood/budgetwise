import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Category from "../models/Category.js";


export const register = async (req, res) => {
try {

  // Validate input
let { email, password } = req.body ?? {};
  // Trim and lowercase email
email = String(email || "").trim().toLowerCase();
  // Check if email and password are provided
if (!email || !password) return res.status(400).send("Email & password required");
  // Check if email is already registered
const exists = await User.findOne({ where: { email } });
  // If exists, return 409 Conflict
if (exists) return res.status(409).send("Email already registered");
  // Hash the password with bcrypt
const passwordHash = await bcrypt.hash(password, 11);
const user = await User.create({ email, passwordHash });

// Create default categories for the new user
await Category.create({ userId: user.id, name: "הכנסה", type: "Income" });
await Category.create({ userId: user.id, name: "הוצאה", type: "Expense" });

return res.status(201).json({ id: user.id, email: user.email });
} catch (e) { console.error(e); return res.status(500).send("Server error"); }
};


export const login = async (req, res) => {
  try {
    // 1. Get email and password from the request body, trim and lowercase the email
    let { email, password } = req.body ?? {};
    email = String(email || "").trim().toLowerCase();

    // 2. Find the user in the database by email
    const user = await User.findOne({ where: { email } });

    // 3. If user not found, return 401 Unauthorized
    if (!user) return res.status(401).send("Invalid credentials");

    // 4. Compare the provided password with the stored password hash
    const ok = await bcrypt.compare(String(password || ""), user.passwordHash);

    // 5. If password does not match, return 401 Unauthorized
    if (!ok) return res.status(401).send("Invalid credentials");

    // 6. If credentials are valid, create a JWT token with the user's id
    const token = jwt.sign(
      { sub: user.id },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "14d" }
    );

    // 7. Return the token and user info in the response
    return res.json({ token, user: { id: user.id, email: user.email } });
  } catch (e) {
    // 8. If any error occurs, log it and return 500 Server Error
    console.error(e);
    return res.status(500).send("Server error");
  }
};