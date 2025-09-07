import { Router } from "express";
import {
  listRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  runRecurringNow
} from "../controllers/RecurringController.js";

const r = Router();

r.get("/", listRecurring);
r.post("/", createRecurring);
r.patch("/:id", updateRecurring);
r.delete("/:id", deleteRecurring);
r.post("/run-due", runRecurringNow);

export default r;   // ← חייב להיות export default
