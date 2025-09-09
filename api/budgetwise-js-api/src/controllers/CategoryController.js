import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import { fn, col, where } from 'sequelize';

// Get all categories for the user
export const getCategories = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    // Find all categories for the user, ordered by type and name
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

// Get a category by id
export const getCategoryById = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    // Find category by user and id
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

// Create a new category
export const createCategory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    let { name, type } = req.body ?? {};
    const clean = String(name ?? '').trim();
    if (!clean) return res.status(400).send('Name is required.');

    // Normalize type to "Income" or "Expense"
    const t = String(type ?? '').toLowerCase();
    const normalized =
      t === 'income'  ? 'Income'  :
      t === 'expense' ? 'Expense' : null;
    if (!normalized) return res.status(400).send('Type must be Income or Expense.');

    // Check for duplicate category name (case-insensitive)
    const exists = await Category.findOne({
      where: {
        userId: req.user.id,
        name: where(fn('LOWER', col('name')), clean.toLowerCase())
      }
    });
    if (exists) return res.status(409).send('Category name already exists.');

    // Create the category
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

// Delete a category by id (only if no transactions exist)
export const deleteCategory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).send("Invalid category id");

    // Find the category
    const cat = await Category.findOne({ where: { id, userId: req.user.id } });
    if (!cat) return res.sendStatus(404);

    // Check if there are transactions for this category
    const txCount = await Transaction.count({ where: { userId: req.user.id, categoryId: id } });
    if (txCount > 0) return res.status(409).send("Cannot delete a category that has transactions");

    // Delete the category
    await Category.destroy({ where: { id, userId: req.user.id } });
    return res.sendStatus(204);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
};