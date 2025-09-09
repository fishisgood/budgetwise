import { Op } from "sequelize";
import RecurringTransaction from "../models/RecurringTransaction.js";
import Transaction from "../models/Transaction.js";
import Category from "../models/Category.js";

// Helper: format date as YYYY-MM-DD
function toISO(d) { return d.toISOString().slice(0,10); }

// Helper: get last day of a month
function lastDayOfMonth(y,m) { return new Date(Date.UTC(y, m+1, 0)).getUTCDate(); }

// Helper: add n months to a date, keeping day of month
function addMonthsKeepDay(dateISO, n, dayOfMonth) {
  const [y,m,_d] = dateISO.split("-").map(Number);
  const base = new Date(Date.UTC(y, m-1, 1));
  base.setUTCMonth(base.getUTCMonth() + n);
  const ly = base.getUTCFullYear();
  const lm = base.getUTCMonth();
  const dom = Math.min(dayOfMonth || _d, lastDayOfMonth(ly,lm));
  return toISO(new Date(Date.UTC(ly, lm, dom)));
}

// Helper: add n days to a date
function addDays(dateISO, n) {
  const d = new Date(dateISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

// Run all due recurring transactions for a user (optionally for a specific date)
export async function runDueRecurring(userId, onISO /* YYYY-MM-DD */) {
  const today = onISO || toISO(new Date());
  // Find all recurring transactions due today or earlier
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
    // Get category type to determine sign of amount
    const cat = await Category.findOne({ where: { id: r.categoryId, userId }, attributes: ["type"], raw: true });
    const rawAmount = Number(r.amount);
    const isExpense = String(cat?.type || "").toLowerCase() === "expense";
    const signed = isExpense ? -Math.abs(rawAmount) : Math.abs(rawAmount);

    // Create a Transaction for the scheduled date
    await Transaction.create({
      userId,
      categoryId: r.categoryId,
      amount: signed,
      date: r.nextRunDate,
      note: r.note || null,
    });
    created++;

    // Advance nextRunDate according to cadence and interval
    let next = r.nextRunDate;
    if (r.cadence === "daily") next = addDays(r.nextRunDate, r.interval);
    else if (r.cadence === "weekly") next = addDays(r.nextRunDate, 7 * r.interval);
    else if (r.cadence === "monthly") next = addMonthsKeepDay(r.nextRunDate, r.interval, r.dayOfMonth);

    // Update nextRunDate in the recurring transaction
    await RecurringTransaction.update({ nextRunDate: next }, { where: { id: r.id } });
  }
  // Return how many transactions were created and how many were due
  return { created, count: due.length };
}