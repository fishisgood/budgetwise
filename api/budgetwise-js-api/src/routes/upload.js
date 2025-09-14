// routes/upload.js
import express from "express";
import multer from "multer";
import { importExcel ,saveTransactions} from "../controllers/UploadController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// POST /api/upload/excel
router.post("/excel", upload.single("file"), importExcel);
router.post('/save', saveTransactions); 

export default router;
