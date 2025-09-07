import { Router } from "express";
import { exportMonthlyXlsx } from "../controllers/ExportController.js";

const r = Router();
r.get("/monthly.xlsx", exportMonthlyXlsx);

export default r;