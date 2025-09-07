import { Op, fn, col, literal } from "sequelize";
import Transaction from "../models/Transaction.js";


function iso(y,m,d) { return new Date(Date.UTC(y,m-1,d)); }


export const getMonthlyInsights = async (req, res) => {
        if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
const year = Number(req.query.year), month = Number(req.query.month);
if (!year || !month) return res.status(400).send("year & month required");
const start = iso(year, month, 1), end = iso(year, month+1, 1);


// 1) Month totals (signed)
const txs = await Transaction.findAll({ where: { userId: req.user.id, date: { [Op.gte]: start, [Op.lt]: end } }, attributes: ["amount","categoryId"], raw: true });
const toNum = (x)=> typeof x === "number" ? x : Number(x) || 0;
let income=0, expense=0; const byCat = new Map();
for (const t of txs) {
const a = toNum(t.amount);
if (a>0) income += a; else expense += -a;
const agg = byCat.get(t.categoryId) || { income:0, expense:0 };
if (a>0) agg.income += a; else agg.expense += -a;
byCat.set(t.categoryId, agg);
}


// 2) Projection to month end (simple): net/day_so_far * days_in_month
const today = new Date();
const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
const dayOfMonth = (today.getUTCFullYear()===year && (today.getUTCMonth()+1)===month) ? today.getUTCDate() : daysInMonth;
const net = income - expense;
const avgPerDay = dayOfMonth ? net / dayOfMonth : 0;
const projectedNet = Math.round((avgPerDay * daysInMonth) * 100) / 100;


// 3) Simple spikes: current expense per category vs. last 3 months average
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


res.json({ income, expense, net, projectedNet, topExpenseCategories: [...byCat.entries()].sort((a,b)=>b[1].expense-a[1].expense).slice(0,5).map(([cid,agg])=>({ categoryId: cid, expense: agg.expense })), spikes });
};