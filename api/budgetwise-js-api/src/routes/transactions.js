import express from 'express';
import { getTransactions, createTransaction, deleteTransaction, getAllTransactions } from '../controllers/TransactionController.js';

const router = express.Router();

router.get('/', getTransactions);
router.post('/', createTransaction);
router.delete("/:id", deleteTransaction);
router.get('/all', getAllTransactions); // New route to get all transactions
export default router;