// controllers/RecurringController.js
import RecurringTransaction from "../models/RecurringTransaction.js";
import Transaction from "../models/Transaction.js";
import { runDueRecurring } from "../services/recurringService.js";

// GET /api/recurring
export const listRecurring = async (req, res) => {
  try {
        if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
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

// POST /api/recurring
export const createRecurring = async (req, res) => {
  try {
        if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { categoryId, amount, cadence, interval, startDate, note } = req.body;
    if (!categoryId || !amount || !cadence || !interval || !startDate) {
      return res.status(400).send("Missing fields");
    }
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

// PATCH /api/recurring/:id
export const updateRecurring = async (req, res) => {
  try {
        if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const id = Number(req.params.id);
    const patch = req.body ?? {};
    await RecurringTransaction.update(patch, { where: { id, userId: req.user.id } });
    const r = await RecurringTransaction.findOne({ where: { id, userId: req.user.id }, raw: true });
    if (!r) return res.sendStatus(404);
    res.json(r);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// DELETE /api/recurring/:id
export const deleteRecurring = async (req, res) => {
  try {
    const id = Number(req.params.id);
    await RecurringTransaction.destroy({ where: { id, userId: req.user.id } });
    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// POST /api/recurring/run-now
export const runRecurringNow = async (req, res) => {
  try {
    const { created, count } = await runDueRecurring(req.user.id);
    res.json({ created, due: count });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

// POST /api/recurring/run-due
export const runDue = async (req, res) => {
  try {
        if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const today = new Date();
    const due = await RecurringTransaction.findAll({ where: { userId: req.user.id } });

    const created = [];
    for (const r of due) {
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
