import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Register a new user
export const register = async (req, res) => {
  try {
    // Get email and password from request, sanitize email
    let { email, password } = req.body ?? {};
    email = String(email || "").trim().toLowerCase();
    if (!email || !password) return res.status(400).send("Email & password required");

    // Check if email already exists
    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(409).send("Email already registered");

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 11);

    // Create the user
    const user = await User.create({ email, passwordHash });
    return res.status(201).json({ id: user.id, email: user.email });
  } catch (e) {
    console.error(e); return res.status(500).send("Server error");
  }
};

// Login a user
export const login = async (req, res) => {
  try {
    // Get email and password from request, sanitize email
    let { email, password } = req.body ?? {};
    email = String(email || "").trim().toLowerCase();

    // Find user by email
    const user = await User.findOne({ where: { email } });

    // If user not found, return 401
    if (!user) return res.status(401).send("Invalid credentials");

    // Compare password with hash
    const ok = await bcrypt.compare(String(password || ""), user.passwordHash);

    // If password does not match, return 401
    if (!ok) return res.status(401).send("Invalid credentials");

    // Create JWT token for user
    const token = jwt.sign(
      { sub: user.id },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "10m" }
    );

    // Return token and user info
    return res.json({ token, user: { id: user.id, email: user.email } });
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
};