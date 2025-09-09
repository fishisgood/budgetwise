import { Op, fn, literal } from "sequelize";
import Transaction from "../models/Transaction.js";
import Category from "../models/Category.js";

// Get monthly summary (income, expense, balance change)
export const getMonthlySummary = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month) return res.status(400).send("year and month are required");

  // Calculate start and end dates for the month
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end   = new Date(Date.UTC(year, month, 1));

  try {
    // Get all transactions for the month
    const txs = await Transaction.findAll({
      where: { userId: req.user.id, date: { [Op.gte]: start, [Op.lt]: end } },
      attributes: ["amount"],
      raw: true
    });

    // Convert amounts to numbers
    const toNum = (v) => (typeof v === "number" ? v : Number(v));
    // Sum income (positive amounts) and expense (negative amounts)
    const income  = txs.reduce((s, t) => s + Math.max(0,  toNum(t.amount)), 0);
    const expense = txs.reduce((s, t) => s + Math.max(0, -toNum(t.amount)), 0);

    // Return summary
    return res.json({ income, expense, balanceChange: income - expense });
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
};

// Get breakdown by category for the month
export const getCategoriesBreakdown = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const year  = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month) return res.status(400).send("year and month are required");

  // Calculate start and end dates for the month
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end   = new Date(Date.UTC(year, month, 1));

  try {
    // Aggregate transactions by category: income, expense, total signed
    const rows = await Transaction.findAll({
      where: { userId: req.user.id, date: { [Op.gte]: start, [Op.lt]: end } },
      attributes: [
        "categoryId",
        [fn("SUM", literal("CASE WHEN amount > 0 THEN CAST(amount AS DOUBLE PRECISION) ELSE 0 END")), "income"],
        [fn("SUM", literal("CASE WHEN amount < 0 THEN -CAST(amount AS DOUBLE PRECISION) ELSE 0 END")), "expense"],
        [fn("SUM", literal("CAST(amount AS DOUBLE PRECISION)")), "totalSigned"]
      ],
      group: ["categoryId"],
      raw: true
    });

    if (rows.length === 0) return res.json([]); // No transactions for month

    // Get category details for all involved categories
    const catIds = rows.map(r => r.categoryId);
    const cats = await Category.findAll({
      where: { userId: req.user.id, id: { [Op.in]: catIds } },
      attributes: ["id", "name", "type"],
      raw: true
    });

    // Map category id to category info
    const catMap = new Map(cats.map(c => [String(c.id), c]));

    // Build breakdown items for each category
    const items = rows.map(r => {
      const c = catMap.get(String(r.categoryId));
      const toNum = v => (typeof v === "number" ? v : Number(v) || 0);

      const income      = toNum(r.income);
      const expense     = toNum(r.expense);
      const totalSigned = toNum(r.totalSigned);

      return {
        categoryId: r.categoryId,
        categoryName: c?.name ?? "Unknown",
        income,
        expense,
        totalSigned
      };
    }).sort((a, b) => Math.abs(b.totalSigned) - Math.abs(a.totalSigned));

    // Return breakdown
    return res.json(items);
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
};