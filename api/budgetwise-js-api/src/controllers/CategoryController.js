// controllers/CategoryController.js
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import { fn, col, where } from 'sequelize';

// GET /api/categories
export const getCategories = async (req, res) => {
  try {
        if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const categories = await Category.findAll({
      where: { userId: req.user.id},
      order: [['type','ASC'], ['name','ASC']],
      raw: true
    });
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

export const getCategoryById = async (req, res) => {
  try {
        if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const category = await Category.findOne({
      where: { userId: req.user.id, id: req.params.id }
    });
    if (!category) return res.sendStatus(404);
    res.json(category);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

// POST /api/categories
export const createCategory = async (req, res) => {
  try {
        if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    let { name, type } = req.body ?? {};
    const clean = String(name ?? '').trim();
    if (!clean) return res.status(400).send('Name is required.');

    // נרמול type
    const t = String(type ?? '').toLowerCase();
    const normalized =
      t === 'income'  ? 'Income'  :
      t === 'expense' ? 'Expense' : null;
    if (!normalized) return res.status(400).send('Type must be Income or Expense.');

    // בדיקת כפילות
    const exists = await Category.findOne({
      where: {
        userId: req.user.id,
        name: where(fn('LOWER', col('name')), clean.toLowerCase())
      }
    });
    if (exists) return res.status(409).send('Category name already exists.');

    const cat = await Category.create({ userId: req.user.id, name: clean, type: normalized });
    return res.status(201).json(cat);
  } catch (err) {
    console.error(err);
    if (err?.name === 'SequelizeUniqueConstraintError')
      return res.status(409).send('Category name already exists.');
    if (err?.name === 'SequelizeDatabaseError' && /enum/i.test(err.message))
      return res.status(400).send('Invalid category type in DB. Expected Income/Expense.');
    return res.status(500).send('Server error');
  }
};

// DELETE /api/categories/:id
export const deleteCategory = async (req, res) => {
  try {
        if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).send("Invalid category id");

    const cat = await Category.findOne({ where: { id, userId: req.user.id } });
    if (!cat) return res.sendStatus(404);

    const txCount = await Transaction.count({ where: { userId: req.user.id, categoryId: id } });
    if (txCount > 0) return res.status(409).send("Cannot delete a category that has transactions");

    await Category.destroy({ where: { id, userId: req.user.id } });
    return res.sendStatus(204);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
};
