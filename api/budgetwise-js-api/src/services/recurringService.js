import { Op } from "sequelize";
import RecurringTransaction from "../models/RecurringTransaction.js";
import Transaction from "../models/Transaction.js";
import Category from "../models/Category.js";


function toISO(d) { return d.toISOString().slice(0,10); }
function lastDayOfMonth(y,m) { return new Date(Date.UTC(y, m+1, 0)).getUTCDate(); }


function addMonthsKeepDay(dateISO, n, dayOfMonth) {
const [y,m,_d] = dateISO.split("-").map(Number);
const base = new Date(Date.UTC(y, m-1, 1));
base.setUTCMonth(base.getUTCMonth() + n);
const ly = base.getUTCFullYear();
const lm = base.getUTCMonth();
const dom = Math.min(dayOfMonth || _d, lastDayOfMonth(ly,lm));
return toISO(new Date(Date.UTC(ly, lm, dom)));
}


function addDays(dateISO, n) {
const d = new Date(dateISO + "T00:00:00Z");
d.setUTCDate(d.getUTCDate() + n);
return toISO(d);
}


export async function runDueRecurring(userId, onISO /* YYYY-MM-DD */) {
const today = onISO || toISO(new Date());
const due = await RecurringTransaction.findAll({
where: {
userId,
isPaused: false,
nextRunDate: { [Op.lte]: today },
[Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: today } }],
},
raw: true,
});


let created = 0;
for (const r of due) {
// sign amount by category.type
const cat = await Category.findOne({ where: { id: r.categoryId, userId }, attributes: ["type"], raw: true });
const rawAmount = Number(r.amount);
const isExpense = String(cat?.type || "").toLowerCase() === "expense";
const signed = isExpense ? -Math.abs(rawAmount) : Math.abs(rawAmount);


// create Transaction for the scheduled date (nextRunDate)
await Transaction.create({
userId,
categoryId: r.categoryId,
amount: signed,
date: r.nextRunDate,
note: r.note || null,
});
created++;


// advance nextRunDate
let next = r.nextRunDate;
if (r.cadence === "daily") next = addDays(r.nextRunDate, r.interval);
else if (r.cadence === "weekly") next = addDays(r.nextRunDate, 7 * r.interval);
else if (r.cadence === "monthly") next = addMonthsKeepDay(r.nextRunDate, r.interval, r.dayOfMonth);


await RecurringTransaction.update({ nextRunDate: next }, { where: { id: r.id } });
}
return { created, count: due.length };
}