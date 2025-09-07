import { Router } from "express";
import { getMonthlyInsights } from "../controllers/InsightsController.js";
const r = Router();
r.get("/monthly", getMonthlyInsights);
export default r;
// app.use("/api/Insights", insightsRouter)