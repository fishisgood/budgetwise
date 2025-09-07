import * as chrono from "chrono-node";
import Category from "../models/Category.js";
import Transaction from "../models/Transaction.js";

// ==== Optional OpenAI ====
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    const { OpenAI } = await import("openai");
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch {}

// ==== Hebrew aliases for categories (expand as you wish) ====
const HEBREW_ALIASES = {
  "קניות": ["קניות","סופר","סופרמרקט","מכולת","שופרסל","רמי לוי","יינות ביתן","סופר-פארם","סופר פארם","am:pm","am pm"],
  "דלק": ["דלק","תחנת דלק","פז","סונול","דור אלון","yellow","מנטה"],
  "מסעדה": ["מסעדה","מסעדות","אוכל","וולט","תן ביס","טייק אווי","מקדונלד","בורגר","פיצה","קפה"],
  "שכר דירה": ["שכ\"ד","שכר דירה","שכירות","דמי שכירות"],
  "משכורת": ["משכורת","שכר","הפקדה","salary","payroll","מענק"],
  "חשמל": ["חשמל","חברת חשמל"],
  "מים": ["מים","תאגיד מים"],
  "ארנונה": ["ארנונה","עירייה","עיריה"]
};

const EXPENSE_WORDS = ["קניתי","שילמתי","חויבתי","הזמנתי","רכשתי","דלק","סופר","מסעדה","תשלום"];
const INCOME_WORDS  = ["קיבלתי","הפקדה","משכורת","שכר","החזר","מענק"];

const norm = (s) => String(s ?? "").toLowerCase();

// Hebrew relative date fallback
function parseHebrewRelativeDate(text, base = new Date()) {
  const t = norm(text);
  const d = new Date(base);

  if (/שלשום/.test(t)) { d.setDate(d.getDate() - 2); return d; }
  if (/אתמול/.test(t))  { d.setDate(d.getDate() - 1); return d; }
  if (/מחר/.test(t))    { d.setDate(d.getDate() + 1); return d; }
  if (/היום/.test(t))   { return d; }

  const m = t.match(/לפני\s+(\d+)\s*ימים/);
  if (m) { d.setDate(d.getDate() - Number(m[1])); return d; }

  // dd[./-]mm[./-]yyyy?  (גם 7/9 וגם 07.09.25)
  const m2 = t.match(/(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/);
  if (m2) {
    let [, dd, mm, yy] = m2;
    const year = yy ? (yy.length === 2 ? 2000 + Number(yy) : Number(yy)) : d.getFullYear();
    const parsed = new Date(year, Number(mm) - 1, Number(dd));
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

function findCategoryByAliases(text, cats) {
  const t = norm(text);

  // 1) התאמה ישירה לפי שם הקטגוריה של המשתמש
  for (const c of cats) {
    if (t.includes(norm(c.name))) return c;
  }
  // 2) לפי שמות נרדפים
  for (const [canon, terms] of Object.entries(HEBREW_ALIASES)) {
    if (terms.some((term) => t.includes(norm(term)))) {
      const exact = cats.find((c) => norm(c.name).includes(norm(canon)));
      if (exact) return exact;
      const type = canon === "משכורת" ? "Income" : "Expense";
      const byType = cats.find((c) => c.type === type);
      if (byType) return byType;
    }
  }
  return null;
}

function inferSignByCategory(amount, category) {
  if (amount == null) return amount;
  if (!category) return amount;
  if (category.type === "Expense" && amount > 0) return -amount;
  if (category.type === "Income"  && amount < 0) return -amount;
  return amount;
}

export const parseTransactionText = async (req, res) => {
  const { text } = req.body ?? {};
  if (!text) return res.status(400).send("text is required");
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  // 1) סכום (תומך גם בנקודה/פסיק)
  const mAmount = text.match(/([+-]?\d+(?:[.,]\d{1,2})?)/);
  let amount = mAmount ? Number(mAmount[1].replace(",", ".")) : null;

  // 2) תאריך: קודם נסיון עברית, ואז chrono, ואז היום
  let parsed = parseHebrewRelativeDate(text, new Date());
  if (!parsed) parsed = chrono.parseDate(text, new Date(), { forwardDate: true });
  const date = (parsed ?? new Date()).toISOString().slice(0, 10);

  // 3) קטגוריה (כולל שמות נרדפים)
  const cats = await Category.findAll({
    where: { userId: req.user.id },
    attributes: ["id","name","type"],
    raw: true
  });
  let best = findCategoryByAliases(text, cats);

  // 4) סימן לפי סוג קטגוריה (הוצאה שלילית, הכנסה חיובית)
  amount = inferSignByCategory(amount, best);

  // 5) OpenAI (אופציונלי) – שיפור הצעה + ניסיון למפות קטגוריה אם טרם נמצא
  let refined = { amount, date, categoryId: best?.id ?? null, note: text };
  if (openai) {
    const aiPrompt = [
      "אתה מקבל תיאור תנועה חופשי (בעברית/אנגלית).",
      "החזר JSON בלבד במבנה: { amount:number, date:string(YYYY-MM-DD), note:string }.",
      "אם מוזכר 'אתמול/שלשום/לפני X ימים' חשב תאריך יחסי.",
      `משפט: ${text}`
    ].join("\n");

    try {
      const resp = await openai.responses.create({ model: "gpt-4.1-mini", input: aiPrompt });
      const raw = JSON.parse(resp.output_text || "{}");
      refined = { ...refined, ...raw };
      if (typeof refined.amount === "string") refined.amount = Number(String(refined.amount).replace(",", "."));
      if (refined.date) refined.date = String(refined.date).slice(0, 10);
      // עדכון סימן שוב (למקרה שה-AI החזיר בלי סימן)
      refined.amount = inferSignByCategory(refined.amount, best);
    } catch { /* ignore */ }

    // אם אין קטגוריה עדיין – ננסה לכוון עם רשימת הקטגוריות למודל
    if (!best) {
      try {
        const catsPrompt = [
          "התאם את התנועה לקטגוריה מהרשימה והחזר רק את categoryId (מספר) או null.",
          "אם מופיעות מילים שקשורות לסופר/מכולת – זו 'קניות'.",
          `טקסט: ${text}`,
          `קטגוריות: ${JSON.stringify(cats)}`
        ].join("\n");
        const resp2 = await openai.responses.create({ model: "gpt-4.1-mini", input: catsPrompt });
        const id = Number((resp2.output_text || "").match(/\d+/)?.[0] ?? NaN);
        if (!isNaN(id)) refined.categoryId = id;
      } catch { /* ignore */ }
    }
  }

  return res.json({ suggestion: refined, categories: cats });
};

export const coachAdvice = async (req, res) => {
  const { summary, insights } = req.body ?? {};
  if (!summary && !insights) return res.status(400).send("summary/insights required");

  // ==== Heuristic fallback (Hebrew) ====
  const tips = [];
  // יחס חיסכון
  if ((summary?.income ?? 0) > 0) {
    const saveRate = ((summary.income - (summary.expense || 0)) / summary.income) * 100;
    tips.push(`יחס חיסכון משוער: ${isFinite(saveRate) ? saveRate.toFixed(1) : 0}%`);
  }
  // עודף/גרעון
  const net = (summary?.income || 0) - (summary?.expense || 0);
  if (net < 0) tips.push(`את/ה בגרעון של ₪${Math.abs(net).toFixed(0)} — שקול/י קיצוץ ב־2–3 קטגוריות גדולות.`);
  else if (net > 0) tips.push(`את/ה בעודף של ₪${net.toFixed(0)} — כדאי להעביר אוטומטית לחיסכון/הלוואה כדי לא “להישחק”.`);

  // קפיצות בהוצאות
  if (insights?.spikes?.length) {
    for (const s of insights.spikes) {
      tips.push(`קפיצה בהוצאות בקטגוריה #${s.categoryId}: נוכחי ₪${(s.current ?? 0).toFixed(0)} מול ממוצע 3 ח׳ ₪${(s.avg3m ?? 0).toFixed(0)} (×${s.factor ?? "?"}).`);
    }
  }

  // אם אין OpenAI — נחזיר את ההצעות ההיוריסטיות בעברית
  if (!openai) return res.json({ advice: tips });

  try {
    const prompt = [
      "אתה מאמן תקציב אישי. תן 3–5 עצות קצרות, ספציפיות ויישומיות בעברית בלבד.",
      "הצג כרשימת נקודות (ללא מספרים).",
      `Summary: ${JSON.stringify(summary)}`,
      `Insights: ${JSON.stringify(insights)}`
    ].join("\n");
    const resp = await openai.responses.create({ model: "gpt-4.1-mini", input: prompt });
    const text = (resp.output_text || "").trim();

    // נפרק לשורות, נוריד סימני •/–/מספור, נסנן ריקים
    let lines = text.split(/\r?\n/).map(l => l.replace(/^\s*([•\-\d.)\]]\s*)+/g, "").trim()).filter(Boolean);

    // הגבלה סבירה
    if (!lines.length) lines = tips;
    else lines = lines.slice(0, 5);

    return res.json({ advice: lines });
  } catch {
    return res.json({ advice: tips });
  }
};
