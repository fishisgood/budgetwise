import cron from "node-cron";
import { Op } from "sequelize";
import RecurringTransaction from "../models/RecurringTransaction.js";
import Transaction from "../models/Transaction.js";


export function startRecurringJob() {
  // ירוץ כל יום בחצות
  cron.schedule("0 0 * * *", async () => {
    console.log("[cron] Checking recurring transactions...");
    const now = new Date();

    const recs = await RecurringTransaction.findAll({
      where: {
        nextRunDate: { [Op.lte]: now },
        isPaused: false,
      },
    });

    for (const r of recs) {
      // צור Transaction חדש
      await Transaction.create({
        userId: r.userId,
        categoryId: r.categoryId,
        amount: r.amount,
        note: r.note,
        date: now,
      });

      // עדכן את התאריך הבא
      let next = new Date(r.nextRunDate);
      if (r.cadence === "monthly") next.setMonth(next.getMonth() + r.interval);
      if (r.cadence === "weekly") next.setDate(next.getDate() + 7 * r.interval);
      if (r.cadence === "daily") next.setDate(next.getDate() + r.interval);

      r.nextRunDate = next;
      await r.save();
    }
  });
}
