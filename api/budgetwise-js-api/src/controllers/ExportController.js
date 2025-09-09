import ExcelJS from "exceljs";
import { Op } from "sequelize";
import Transaction from "../models/Transaction.js";
import Category from "../models/Category.js";

// Export monthly transactions to XLSX file
export const exportMonthlyXlsx = async (req, res) => {
  // Check authentication
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  // Parse year and month from query
  const year = Number(req.query.year), month = Number(req.query.month);
  if (!year || !month) return res.status(400).send("year & month required");
  const start = new Date(Date.UTC(year, month-1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  // Get all transactions for the month, including category info
  const rows = await Transaction.findAll({
    where: { userId: req.user.id, date: { [Op.gte]: start, [Op.lt]: end } },
    include: [{ model: Category, as: "Category", attributes: ["name","type"] }],
    order: [["date","ASC"],["id","ASC"]]
  });

  // Create Excel workbook and worksheet
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`M${month}-${year}`);
  ws.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Category", key: "cat", width: 22 },
    { header: "Type", key: "type", width: 10 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Note", key: "note", width: 40 },
  ];

  // Add rows for each transaction, sum income/expense
  let totalIncome = 0, totalExpense = 0;
  for (const t of rows) {
    const amt = typeof t.amount === "string" ? Number(t.amount) : Number(t.amount);
    if (amt > 0) totalIncome += amt; else totalExpense += -amt;
    ws.addRow({
      date: t.date instanceof Date ? t.date.toISOString().slice(0,10) : t.date,
      cat: t.Category?.name || t.categoryId,
      type: t.Category?.type || "",
      amount: amt,
      note: t.note || "",
    });
  }
  ws.addRow({});
  ws.addRow({ date: "Totals", amount: totalIncome - totalExpense });

  ws.getColumn("amount").numFmt = "#,##0.00";

  // Set response headers for XLSX download
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=budget-${year}-${month}.xlsx`);
  await wb.xlsx.write(res);
  res.end();
};