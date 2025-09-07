import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";


export const register = async (req, res) => {
try {
let { email, password } = req.body ?? {};
email = String(email || "").trim().toLowerCase();
if (!email || !password) return res.status(400).send("Email & password required");
const exists = await User.findOne({ where: { email } });
if (exists) return res.status(409).send("Email already registered");
const passwordHash = await bcrypt.hash(password, 11);
const user = await User.create({ email, passwordHash });
return res.status(201).json({ id: user.id, email: user.email });
} catch (e) { console.error(e); return res.status(500).send("Server error"); }
};


export const login = async (req, res) => {
try {
let { email, password } = req.body ?? {};
email = String(email || "").trim().toLowerCase();
const user = await User.findOne({ where: { email } });
if (!user) return res.status(401).send("Invalid credentials");
const ok = await bcrypt.compare(String(password || ""), user.passwordHash);
if (!ok) return res.status(401).send("Invalid credentials");
const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET || "dev_secret", { expiresIn: "14d" });
return res.json({ token, user: { id: user.id, email: user.email } });
} catch (e) { console.error(e); return res.status(500).send("Server error"); }
};