import { Router } from "express";
import { register, login } from "../controllers/AuthController.js";

const r = Router();

// רישום משתמש חדש
r.post("/register", register);

// התחברות
r.post("/login", login);

export default r;
