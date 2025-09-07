import express from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  deleteCategory 
} from '../controllers/CategoryController.js';

const router = express.Router();

router.get('/', getCategories);
router.get('/:id', getCategoryById);
router.post('/', createCategory);
router.delete("/:id", deleteCategory);

export default router;