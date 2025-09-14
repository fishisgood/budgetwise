import { Op } from "sequelize";
import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';

export const getTransactions = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    // Extract query parameters for filtering and pagination
    const { year, month, from, to, categoryId, page = 1, pageSize = 20 } = req.query;
    const where = { userId: req.user.id };

    // Filter by category
    if (categoryId) where.categoryId = categoryId;

    // Filter by date range (from/to)
    if (from || to) {
      where.date = {};
      if (from) where.date[Op.gte] = from;
      if (to) where.date[Op.lte] = to;
    }

    // Filter by year/month if provided
    if (year && month) {
      const y = Number(year), m = Number(month);
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 1));
      where.date = { [Op.gte]: start.toISOString().slice(0, 10), [Op.lt]: end.toISOString().slice(0, 10) };
    }

    // Query transactions with pagination and join category info
    const { count, rows } = await Transaction.findAndCountAll({
      where,
      offset: (page - 1) * pageSize,
      limit: pageSize,
      order: [['date', 'DESC']],
      include: [{ model: Category, attributes: ['type', 'name'] }]
    });

    // Format each transaction to include category type and name
    const items = rows.map(tx => ({
      ...tx.get(),
      categoryType: tx.Category?.type,
      categoryName: tx.Category?.name
    }));

    res.json({
      items,
      page: Number(page),
      pageSize: Number(pageSize),
      totalCount: count
    });
  } catch (err) {
    res.status(500).send('Server error');
  }
};

// Create a new transaction for the authenticated user
export const createTransaction = async (req, res) => {
  try {
    // Check authentication
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    // Extract transaction details from request body
    const { categoryId, amount, date, note } = req.body ?? {};
    if (!categoryId || !amount || !date) return res.status(400).send('Missing required fields');

    // Find the category and get its type
    const cat = await Category.findOne({
      where: { id: Number(categoryId), userId: req.user.id },
      attributes: ['type']
    });
    if (!cat) return res.status(400).send('Category not found');

    // Validate amount
    const raw = Number(amount);
    if (!Number.isFinite(raw) || raw === 0) return res.status(400).send('Amount must be non-zero number');

    // Determine sign of amount based on category type (Expense is negative)
    const isExpense = String(cat.type).toLowerCase() === 'expense';
    const signed = isExpense ? -Math.abs(raw) : Math.abs(raw);

    // Create the transaction in the database
    const tx = await Transaction.create({
      userId: req.user.id,
      categoryId: Number(categoryId),
      amount: signed,            // Always signed correctly
      date,                      // YYYY-MM-DD if DATEONLY
      note: (note ?? '').trim() || null
    });

    // Return the created transaction
    return res.status(201).json(tx);
  } catch (err) {
    // Log error and return 500
    console.error(err);
    return res.status(500).send('Server error');
  }
};
export const deleteTransaction = async (req, res) => {
  try {
    // Check authentication
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { id } = req.params;
    if (!id) return res.status(400).send('Transaction ID is required');
    const tx = await Transaction.findOne({ where: { id: Number(id), userId: req.user.id } });
    if (!tx) return res.status(404).send('Transaction not found');
    await tx.destroy();
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
};

// GET /api/Transactions/all
export const getAllTransactions = async (req, res) => {
  const items = await Transaction.findAll({ where: { userId: req.user.id } });
  res.json(items);
};