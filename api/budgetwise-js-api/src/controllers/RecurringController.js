import RecurringTransaction from "../models/RecurringTransaction.js";
import Transaction from "../models/Transaction.js";
import { runDueRecurring } from "../services/recurringService.js";

// List all recurring transactions for the user
export const listRecurring = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    // Get all recurring transactions for the user, ordered by start date
    const items = await RecurringTransaction.findAll({
      where: { userId: req.user.id },
      order: [["startDate", "ASC"]],
    });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// Create a new recurring transaction
export const createRecurring = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    // Extract details from request body
    const { categoryId, amount, cadence, interval, startDate, note } = req.body;
    if (!categoryId || !amount || !cadence || !interval || !startDate) {
      return res.status(400).send("Missing fields");
    }
    // Create the recurring transaction
    const item = await RecurringTransaction.create({
      userId: req.user.id,
      categoryId,
      amount,
      cadence,
      interval,
      startDate,
      note: note?.trim() || null,
    });
    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// Update a recurring transaction by id
export const updateRecurring = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const id = Number(req.params.id);
    const patch = req.body ?? {};
    // Update the recurring transaction
    await RecurringTransaction.update(patch, { where: { id, userId: req.user.id } });
    // Fetch the updated transaction
    const r = await RecurringTransaction.findOne({ where: { id, userId: req.user.id }, raw: true });
    if (!r) return res.sendStatus(404);
    res.json(r);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// Delete a recurring transaction by id
export const deleteRecurring = async (req, res) => {
  try {
    const id = Number(req.params.id);
    // Delete the transaction for the user
    await RecurringTransaction.destroy({ where: { id, userId: req.user.id } });
    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// Run all due recurring transactions now (custom logic)
export const runRecurringNow = async (req, res) => {
  try {
    // Run the recurring service for the user
    const { created, count } = await runDueRecurring(req.user.id);
    res.json({ created, due: count });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// Run all due recurring transactions for today
export const runDue = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const today = new Date();
    // Find all recurring transactions for the user
    const due = await RecurringTransaction.findAll({ where: { userId: req.user.id } });

    const created = [];
    for (const r of due) {
      // If the start date is today or earlier, create a transaction
      if (new Date(r.startDate) <= today) {
        const tx = await Transaction.create({
          userId: req.user.id,
          categoryId: r.categoryId,
          amount: r.amount,
          date: today,
          note: r.note || null,
        });
        created.push(tx);
      }
    }
    res.json({ created });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};