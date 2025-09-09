import { Op, fn, col, literal } from "sequelize";
import Transaction from "../models/Transaction.js";

// Helper to create a UTC date
function iso(y,m,d) { return new Date(Date.UTC(y,m-1,d)); }

// Get monthly insights for the user
export const getMonthlyInsights = async (req, res) => {
  // Check authentication
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  // Parse year and month from query
  const year = Number(req.query.year), month = Number(req.query.month);
  if (!year || !month) return res.status(400).send("year & month required");
  const start = iso(year, month, 1), end = iso(year, month+1, 1);

  // 1) Get all transactions for the month
  const txs = await Transaction.findAll({ where: { userId: req.user.id, date: { [Op.gte]: start, [Op.lt]: end } }, attributes: ["amount","categoryId"], raw: true });
  const toNum = (x)=> typeof x === "number" ? x : Number(x) || 0;
  let income=0, expense=0; const byCat = new Map();
  for (const t of txs) {
    const a = toNum(t.amount);
    // Sum income and expense
    if (a>0) income += a; else expense += -a;
    // Aggregate by category
    const agg = byCat.get(t.categoryId) || { income:0, expense:0 };
    if (a>0) agg.income += a; else agg.expense += -a;
    byCat.set(t.categoryId, agg);
  }

  // 2) Projected net for the month (based on current average per day)
  const today = new Date();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dayOfMonth = (today.getUTCFullYear()===year && (today.getUTCMonth()+1)===month) ? today.getUTCDate() : daysInMonth;
  const net = income - expense;
  const avgPerDay = dayOfMonth ? net / dayOfMonth : 0;
  const projectedNet = Math.round((avgPerDay * daysInMonth) * 100) / 100;

  // 3) Find expense spikes by comparing current month to previous 3 months
  const start3 = iso(year, month-3, 1);
  const hist = await Transaction.findAll({
    where: { userId: req.user.id, date: { [Op.gte]: start3, [Op.lt]: start } },
    attributes: ["categoryId", [fn("SUM", literal("CASE WHEN amount < 0 THEN -CAST(amount AS DOUBLE PRECISION) ELSE 0 END")), "expense"]],
    group: ["categoryId"], raw: true
  });
  const histMap = new Map(hist.map(r => [String(r.categoryId), Number(r.expense)||0]));

  const spikes = [];
  for (const [catId, agg] of byCat.entries()) {
    const cur = agg.expense;
    const avg = (histMap.get(String(catId)) || 0) / 3 || 0;
    if (avg > 0 && cur > avg * 1.5) {
      spikes.push({ categoryId: catId, current: cur, avg3m: avg, factor: Math.round((cur/avg)*100)/100 });
    }
  }

  // Return insights: income, expense, net, projection, top categories, spikes
  res.json({
    income,
    expense,
    net,
    projectedNet,
    topExpenseCategories: [...byCat.entries()].sort((a,b)=>b[1].expense-a[1].expense).slice(0,5).map(([cid,agg])=>({ categoryId: cid, expense: agg.expense })),
    spikes
  });
};