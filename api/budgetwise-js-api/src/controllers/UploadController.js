// Controller for handling Excel uploads and transaction import
import pkg from 'xlsx';
const { readFile, utils } = pkg;
import { parseTransactionText } from "./AiController.js";
import { OpenAI } from "openai";
import Category from "../models/Category.js";
import Transaction from "../models/Transaction.js";

// Optional OpenAI setup
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch {}

// --- Helper function to safely parse dates ---
function parseDate(dateValue) {
  if (!dateValue) return new Date().toISOString().slice(0, 10);

  if (dateValue instanceof Date) {
    return isNaN(dateValue) ? new Date().toISOString().slice(0, 10) : dateValue.toISOString().slice(0, 10);
  }

  if (typeof dateValue === 'number') {
    const excelEpoch = new Date(1900, 0, 1);
    const msPerDay = 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch.getTime() + (dateValue - 2) * msPerDay);
    return isNaN(date) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
  }

  const date = new Date(dateValue);
  return isNaN(date) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

// --- Read entire Excel file as raw data ---
function readExcelRaw(filePath) {
  const workbook = readFile(filePath, { raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = utils.sheet_to_json(sheet, { header: 1, defval: "" });
  return rawData;
}

// --- Improved AI analysis ---
async function analyzeExcelWithAI(rawData) {
  if (!openai) {
    return fallbackAnalysis(rawData);
  }

  const sampleData = rawData.slice(0, 40);

  const prompt = [
    "Analyze this Excel bank statement data.",
    "Return ONLY valid JSON with:",
    "- headerRowIndex: the row index (0-based) of the header row (with column names like תאריך, סכום, תיאור)",
    "- columns: exact column names for date, amount, description",
    "- dataStartRowIndex: first row index (after header) with actual data",
    "- dataEndRowIndex: last row index with actual data (skip empty/irrelevant rows)",
    "- relevantRows: array of row indices that contain valid transactions (skip empty/irrelevant rows)",
    "",
    "Example output:",
    '{ "headerRowIndex": 2, "columns": { "date": "תאריך", "amount": "סכום", "description": "תיאור" }, "dataStartRowIndex": 3, "dataEndRowIndex": 22, "relevantRows": [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22], "confidence": 0.95 }',
    "",
    "Excel data:",
    JSON.stringify(sampleData.map((row, i) => ({ row: i, data: row })), null, 1)
  ].join("\n");

  try {
    const resp = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const raw = (resp.output_text || "").replace(/```json|```/g, "").trim();
    let jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        console.log("AI Analysis Result:", result);
        return result;
      } catch (parseError) {
        console.log("JSON parse error:", parseError.message);
        console.log("Raw response:", raw);
      }
    }
  } catch (error) {
    console.log("AI analysis failed:", error.message);
  }

  return fallbackAnalysis(rawData);
}

// --- Fallback analysis ---
function fallbackAnalysis(rawData) {
  const headerKeywords = ['תאריך', 'סכום', 'תיאור', 'date', 'amount', 'description', 'זכות', 'חובה', 'יתרה'];

  let headerRowIndex = 0;
  let maxMatches = 0;

  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    if (!row || !Array.isArray(row)) continue;

    const matchCount = row.filter(cell => {
      const cellStr = String(cell || '').toLowerCase();
      return headerKeywords.some(keyword => cellStr.includes(keyword));
    }).length;

    if (matchCount > maxMatches) {
      maxMatches = matchCount;
      headerRowIndex = i;
    }
  }

  const headers = rawData[headerRowIndex] || [];

  const findColumn = (keywords) => {
    for (const keyword of keywords) {
      const index = headers.findIndex(h =>
        String(h || '').toLowerCase().includes(keyword.toLowerCase())
      );
      if (index !== -1) return headers[index];
    }
    return null;
  };

  return {
    headerRowIndex,
    dataStartRowIndex: headerRowIndex + 1,
    columns: {
      date: findColumn(['תאריך', 'date']) || headers[0],
      amount: findColumn(['סכום', 'amount', 'זכות', 'חובה']) || headers[1],
      description: findColumn(['תיאור', 'description', 'פרטים']) || headers[2]
    },
    confidence: maxMatches > 0 ? 0.7 : 0.3
  };
}

// --- Extract and process transactions with robust amount/category logic ---
async function processTransactions(rawData, analysis, userId) {
  const { headerRowIndex, columns, relevantRows, dataStartRowIndex, dataEndRowIndex } = analysis;
  const headers = rawData[headerRowIndex];

  if (!headers || !Array.isArray(headers)) {
    throw new Error("Invalid header row");
  }

  const dateIndex = headers.indexOf(columns.date);
  const amountIndex = headers.indexOf(columns.amount);
  const descriptionIndex = headers.indexOf(columns.description);

  const cats = await Category.findAll({ where: { userId }, raw: true });
  const processedTransactions = [];

  // Use relevantRows if available, otherwise fallback to range
  const rowIndices = Array.isArray(relevantRows) && relevantRows.length > 0
    ? relevantRows
    : Array.from({ length: (dataEndRowIndex ?? rawData.length - 1) - (dataStartRowIndex ?? headerRowIndex + 1) + 1 }, (_, k) => (dataStartRowIndex ?? headerRowIndex + 1) + k);

  for (const i of rowIndices) {
    const row = rawData[i];
    if (!row || !Array.isArray(row)) continue;

  const dateCell = dateIndex >= 0 ? row[dateIndex] : null;
  const amountCell = amountIndex >= 0 ? row[amountIndex] : null;
  const description = descriptionIndex >= 0 ? row[descriptionIndex] : null;

  // --- Robust amount parsing ---
  let parsedAmount = null;
  if (amountCell !== null && amountCell !== undefined && String(amountCell).trim() !== '' && String(amountCell).trim() !== '0') {
    const cleaned = String(amountCell).replace(/[₪,\s]/g, '').replace(/,/g, '');
    const numMatch = cleaned.match(/-?\d+(\.\d+)?/);
    if (numMatch) {
      parsedAmount = Number(numMatch[0]);
    }
  }

  // --- AI suggestion ---
  let aiSuggestion = {};
  if (description && String(description).trim()) {
    try {
      const enhancedPrompt = `
description: "${description}"
Excel date: ${dateCell || 'not available'}
Excel amount: ${amountCell || 'not available'}

if amount is  zero skip this transaction
Return ONLY valid JSON format without any markdown or extra text:
{
  amount: number_or_null,
  date: YYYY-MM-DD_or_null, 
  note: clean_hebrew_description,
  categoryId: number_or_null
}
      `.trim();

      const fakeReq = { body: { text: enhancedPrompt }, user: { id: userId } };
      const fakeRes = { status: () => ({ send: () => {} }), json: (d) => d };
      const result = await parseTransactionText(fakeReq, fakeRes);
      aiSuggestion = result?.suggestion || {};
    } catch (error) {
      aiSuggestion = {};
    }
  }

  // --- Robust date parsing (after aiSuggestion is defined) ---
  let parsedDate = null;
  if (dateCell !== null && dateCell !== undefined && String(dateCell).trim() !== '') {
    if (typeof dateCell === 'number') {
      const excelEpoch = new Date(1900, 0, 1);
      const msPerDay = 24 * 60 * 60 * 1000;
      const d = new Date(excelEpoch.getTime() + (dateCell - 2) * msPerDay);
      parsedDate = !isNaN(d) ? d.toISOString().slice(0, 10) : null;
    } else {
      const d = new Date(dateCell);
      parsedDate = !isNaN(d) ? d.toISOString().slice(0, 10) : null;
    }
  }
  if (!parsedDate && aiSuggestion.date) {
    const d = new Date(aiSuggestion.date);
    parsedDate = !isNaN(d) ? d.toISOString().slice(0, 10) : null;
  }
  if (!parsedDate) {
    parsedDate = new Date().toISOString().slice(0, 10);
  }

  // Prefer Excel data over AI guesses for amount and date
  const finalAmount = parsedAmount !== null ? parsedAmount : (aiSuggestion.amount ?? 0);
  const finalDate = parsedDate || aiSuggestion.date || new Date().toISOString().slice(0, 10);

  // --- Assign default category if AI did not find one ---
  let categoryId = aiSuggestion.categoryId || null;
if (!categoryId) {
  if (finalAmount > 0) {
    // Prefer generic income category
    const genericIncome = cats.find(c => c.name === "הכנסה");
    categoryId = genericIncome
      ? genericIncome.id
      : cats.find(c => c.type === "Income")?.id ?? null;
  } else if (finalAmount < 0) {
    // Prefer generic expense category
    const genericExpense = cats.find(c => c.name === 'הוצאה');
    if (genericExpense) {
      categoryId = genericExpense.id;
    } else {
      // If not found, prefer category with type "Expense" and name containing "הוצאה" (covers variants)
      const fallbackExpense = cats.find(c => c.type === "Expense" && c.name.includes("הוצאה"));
      categoryId = fallbackExpense
        ? fallbackExpense.id
        : cats.find(c => c.type === "Expense")?.id ?? null;
    }
  }
  // Absolute fallback: first category
  if (!categoryId && cats.length > 0) categoryId = cats[0].id;
}

  processedTransactions.push({
    userId: userId,
    categoryId,
    amount: finalAmount,
    date: finalDate,
    note: (aiSuggestion.note || String(description || '')).slice(0, 255),
    originalRowIndex: i,
    suggestion: {
      amount: finalAmount,
      date: finalDate,
      categoryId,
      note: (aiSuggestion.note || String(description || '')).slice(0, 255)
    }
  });
}

  return processedTransactions;
}

// --- Save transactions endpoint ---
export const saveTransactions = async (req, res) => {
  if (!req.user) return res.status(401).send("Unauthorized");
  const { transactions } = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).send("No transactions to save");
  }
  try {
    let saved = 0;
    for (const tx of transactions) {
      // Skip transactions with invalid categoryId or amount === 0
      if (!tx.categoryId || typeof tx.amount !== "number" || tx.amount === 0) continue;
      await Transaction.create({
        userId: req.user.id,
        categoryId: tx.categoryId,
        amount: tx.amount,
        date: tx.date,
        note: tx.note
      });
      saved++;
    }
    res.json({ saved });
  } catch (err) {
    res.status(500).send("Failed to save transactions: " + err.message);
  }
};

// --- Main upload analysis endpoint ---
export const importExcel = async (req, res) => {
  if (!req.user) return res.status(401).send("Unauthorized");
  if (!req.file) return res.status(400).send("No file uploaded");

  try {
    const rawData = readExcelRaw(req.file.path);

    if (!rawData || rawData.length === 0) {
      return res.status(400).send("No data found in Excel file");
    }

    console.log(`Excel file has ${rawData.length} rows`);

    const analysis = await analyzeExcelWithAI(rawData);
    const processedTransactions = await processTransactions(rawData, analysis, req.user.id);

    console.log(`Processed ${processedTransactions.length} transactions`);

    res.json({
      analysis,
      transactions: processedTransactions,
      summary: {
        totalExcelRows: rawData.length,
        headerRowIndex: analysis.headerRowIndex + 1,
        processedTransactions: processedTransactions.length,
        confidence: analysis.confidence || 0.5
      }
    });

  } catch (err) {
    console.error("Import error:", err);
    res.status(500).send(`Import failed: ${err.message}`);
  }
};