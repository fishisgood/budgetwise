import express from 'express';
import { getMonthlySummary, getCategoriesBreakdown } from '../controllers/AnalyticsController.js';

const router = express.Router();

router.get('/monthly-summary', getMonthlySummary);
router.get('/categories-breakdown', getCategoriesBreakdown);

export default router;