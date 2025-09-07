import { Router } from "express";
import { parseTransactionText, coachAdvice } from "../controllers/AiController.js";
const r = Router();
r.post("/parse", parseTransactionText);
r.post("/coach", coachAdvice);
export default r;
// app.use("/api/AI", aiRouter)