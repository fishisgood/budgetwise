import cron from "node-cron";
import { Op } from "sequelize";
import RecurringTransaction from "../models/RecurringTransaction.js";
import Transaction from "../models/Transaction.js";

// Starts a scheduled job to process recurring transactions daily at midnight
export function startRecurringJob() {
  // Schedule to run every day at midnight
  cron.schedule("0 0 * * *", async () => {
    console.log("[cron] Checking recurring transactions...");
    const now = new Date();

    // Find all recurring transactions due now or earlier and not paused
    const recs = await RecurringTransaction.findAll({
      where: {
        nextRunDate: { [Op.lte]: now },
        isPaused: false,
      },
    });

    for (const r of recs) {
      // Create a new Transaction for this recurring entry
      await Transaction.create({
        userId: r.userId,
        categoryId: r.categoryId,
        amount: r.amount,
        note: r.note,
        date: now,
      });

      // Calculate the next run date based on cadence and interval
      let next = new Date(r.nextRunDate);
      if (r.cadence === "monthly") next.setMonth(next.getMonth() + r.interval);
      if (r.cadence === "weekly") next.setDate(next.getDate() + 7 * r.interval);
      if (r.cadence === "daily") next.setDate(next.getDate() + r.interval);

      // Update the nextRunDate in the recurring transaction
      r.nextRunDate = next;
      await r.save();
    }
  });
}