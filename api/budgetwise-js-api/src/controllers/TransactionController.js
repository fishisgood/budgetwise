import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';

export const getTransactions = async (req, res) => {
  try {
        if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { from, to, categoryId, page = 1, pageSize = 20 } = req.query;
    const where = { userId: req.user.id };
    if (categoryId) where.categoryId = categoryId;
    if (from) where.date = { ...where.date, $gte: from };
    if (to) where.date = { ...where.date, $lte: to };

    const { count, rows } = await Transaction.findAndCountAll({
      where,
      offset: (page - 1) * pageSize,
      limit: pageSize,
      order: [['date', 'DESC']],
      include: [{ model: Category, attributes: ['type', 'name'] }]
    });

    // Format response to include category type and name
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

export const createTransaction = async (req, res) => {
  try {
        if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { categoryId, amount, date, note } = req.body ?? {};
    if (!categoryId || !amount || !date) return res.status(400).send('Missing required fields');

    const cat = await Category.findOne({
      where: { id: Number(categoryId), userId: req.user.id },
      attributes: ['type']
    });
    if (!cat) return res.status(400).send('Category not found');

    const raw = Number(amount);
    if (!Number.isFinite(raw) || raw === 0) return res.status(400).send('Amount must be non-zero number');

    // קייס-אינסנסיטיב: Expense / EXPENSE / expense
    const isExpense = String(cat.type).toLowerCase() === 'expense';
    const signed = isExpense ? -Math.abs(raw) : Math.abs(raw);

    const tx = await Transaction.create({
      userId: req.user.id,
      categoryId: Number(categoryId),
      amount: signed,            // <<< תמיד חתום נכון
      date,                      // YYYY-MM-DD אם DATEONLY
      note: (note ?? '').trim() || null
    });

    return res.status(201).json(tx);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
};