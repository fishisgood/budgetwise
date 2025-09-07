import { Op, fn, literal } from "sequelize";
import Transaction from "../models/Transaction.js";
import Category from "../models/Category.js";

export const getMonthlySummary = async (req, res) => {

      if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month) return res.status(400).send("year and month are required");

  // [start, end) – יום ראשון בחודש עד ראשון של החודש הבא
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end   = new Date(Date.UTC(year, month, 1));

  try {
    // מביאים amounts כערכים גולמיים (DECIMAL מגיע כמחרוזת)
    const txs = await Transaction.findAll({
      where: { userId: req.user.id, date: { [Op.gte]: start, [Op.lt]: end } },
      attributes: ["amount"],
      raw: true
    });

    const toNum = (v) => (typeof v === "number" ? v : Number(v));
    const income  = txs.reduce((s, t) => s + Math.max(0,  toNum(t.amount)), 0);
    const expense = txs.reduce((s, t) => s + Math.max(0, -toNum(t.amount)), 0);

    return res.json({ income, expense, balanceChange: income - expense });
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
};

export const getCategoriesBreakdown = async (req, res) => {
      if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
  const year  = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month) return res.status(400).send("year and month are required");

  // [start, end)
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end   = new Date(Date.UTC(year, month, 1));

  try {
    // סיכומים פר-קטגוריה (בבת אחת): הכנסה, הוצאה, וסכום חתום
    const rows = await Transaction.findAll({
      where: { userId: req.user.id, date: { [Op.gte]: start, [Op.lt]: end } },
      attributes: [
        "categoryId",
        // SUM(amount WHERE amount>0)
        [fn("SUM", literal("CASE WHEN amount > 0 THEN CAST(amount AS DOUBLE PRECISION) ELSE 0 END")), "income"],
        // SUM(-amount WHERE amount<0)
        [fn("SUM", literal("CASE WHEN amount < 0 THEN -CAST(amount AS DOUBLE PRECISION) ELSE 0 END")), "expense"],
        // SUM(amount) — חתום
        [fn("SUM", literal("CAST(amount AS DOUBLE PRECISION)")), "totalSigned"]
      ],
      group: ["categoryId"],
      raw: true
    });

    if (rows.length === 0) return res.json([]); // אין עסקאות בחודש — עוגה ריקה

    const catIds = rows.map(r => r.categoryId);
    const cats = await Category.findAll({
      where: { userId: req.user.id, id: { [Op.in]: catIds } },
      attributes: ["id", "name", "type"],
      raw: true
    });

    // מפתח כ-string כדי למנוע פספוס מפתחות ('1' מול 1)
    const catMap = new Map(cats.map(c => [String(c.id), c]));

    const items = rows.map(r => {
      const c = catMap.get(String(r.categoryId));
      // ה-DB כבר החזיר מספרים/מחרוזות — נמיר לבטוח
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

    return res.json(items);
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
};