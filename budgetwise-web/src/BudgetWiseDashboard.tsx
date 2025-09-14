// Main dashboard component for BudgetWise app
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Plus, Loader2 } from "lucide-react";
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useNavigate } from "react-router-dom";
import CsvUploader from "./components/CsvUploader";

// ===== Config =====
// API_BASE is the base URL for backend API requests (via Vite proxy or direct)
const API_BASE = "http://localhost:3000";

// ===== Types =====
// All type definitions for categories, transactions, recurring, etc.
type CategoryType = "Income" | "Expense";
type CoachBreakdownItem = {
  categoryId: number;
  name: string;
  type: CategoryType;
  total: number;
  count: number;
};

interface MonthlySummaryDto { income: number; expense: number; balanceChange: number; }
interface CategoryBreakdownItem { categoryId: number; categoryName: string; income?: number; expense?: number; totalSigned?: number; }
interface TxDto { id: number; categoryId: number; amount: number; date: string; note?: string | null; }
interface PagedTx { items: TxDto[]; page: number; pageSize: number; totalCount: number; }
interface CategoryDto { id: number; name: string; type: CategoryType }

type Cadence = "daily" | "weekly" | "monthly";
interface RecurringDto {
  id: number;
  userId: string;
  categoryId: number;
  amount: string | number;
  note?: string | null;
  cadence: Cadence;
  interval: number;
  dayOfMonth?: number | null;
  weekday?: number | null;
  startDate: string;
  endDate?: string | null;
  nextRunDate: string;
  isPaused: boolean;
}

// ===== Utils =====
// COLORS for charts
const COLORS = ["#2563eb","#16a34a","#ea580c","#9333ea","#eab308","#06b6d4","#ef4444","#64748b"];
// Format currency for display
const currency = (x?: unknown) => {
  const n = typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN;
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "–";
};
// Build auth headers for API requests
function authHeaders(init?: RequestInit) {
  const token = localStorage.getItem("jwt");
  const h = new Headers(init?.headers || {});
  if (token) h.set("Authorization", `Bearer ${token}`);
  return h;
}
// Wrapper for fetch that returns JSON and adds Authorization
async function fetchJSON<T = any>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: authHeaders(init) });
  if (!r.ok) throw new Error(await r.text());
  if (r.status === 204) return null as unknown as T;
  return r.json();
}

// ===== Main Component =====
export default function BudgetWiseDashboard() {
  // Navigation for routing
  const navigate = useNavigate();

  // Current year/month state
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<"dashboard"|"recurring"|"insights"|"ai"|"auth">("dashboard");

  // Auth state
  const [userEmail] = useState<string | null>(localStorage.getItem("userEmail"));
  const isLoggedIn = !!localStorage.getItem("jwt");

  // Data state
  const [overallBalance, setOverallBalance] = useState<number>(0);
  const [summary, setSummary] = useState<MonthlySummaryDto | null>(null);
  const [catsBreakdown, setCatsBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [tx, setTx] = useState<PagedTx | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);

  // Paging
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Transaction form state
  const [creatingTx, setCreatingTx] = useState(false);
  const [txForm, setTxForm] = useState<{ amount: string; date: string; categoryId: string; note: string }>({
    amount: "",
    date: new Date().toISOString().slice(0,10),
    categoryId: "",
    note: ""
  });

  // Breakdown for coach advice
  const breakdownForCoach = useMemo<CoachBreakdownItem[]>(() => {
    if (!catsBreakdown?.length) return [];
    // Count transactions per category (based on current page)
    const countByCat = new Map<number, number>();
    (tx?.items || []).forEach(t => {
      countByCat.set(t.categoryId, 1 + (countByCat.get(t.categoryId) || 0));
    });

    // Calculate net income/expense per category
    return catsBreakdown.map(b => {
      const total = typeof b.totalSigned === "number"
        ? b.totalSigned
        : (Number(b.income || 0) - Number(b.expense || 0));
      // Use category type from categories if available, fallback to sign
      const cat = categories.find(c => c.id === b.categoryId);
      const type: CategoryType = cat?.type ?? (total >= 0 ? "Income" : "Expense");
      return {
        categoryId: b.categoryId,
        name: b.categoryName ?? `#${b.categoryId}`,
        type,
        total,
        count: countByCat.get(b.categoryId) || 0,
      };
    });
  }, [catsBreakdown, tx, categories]);

  // Category form state
  const [catForm, setCatForm] = useState<{ name: string; type: CategoryType }>({ name: "", type: "Expense" });

  // Recurring state
  const [recurring, setRecurring] = useState<RecurringDto[]>([]);
  const [recForm, setRecForm] = useState<{ categoryId: string; amount: string; cadence: Cadence; interval: string; dayOfMonth: string; startDate: string; note: string }>({
    categoryId: "",
    amount: "",
    cadence: "monthly",
    interval: "1",
    dayOfMonth: new Date().getUTCDate().toString(),
    startDate: new Date().toISOString().slice(0,10),
    note: ""
  });

  // Insights & AI
  const [insights, setInsights] = useState<any | null>(null);
  const [advice, setAdvice] = useState<string[] | null>(null);
  const [freeText, setFreeText] = useState("");
  const [parseResult, setParseResult] = useState<any | null>(null);

  // UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset page when year/month changes
  useEffect(() => { setPage(1); }, [year, month]);

  // Load dashboard data (summary, breakdown, transactions, categories, overall balance)
  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [sum, breakdown, txs, cats] = await Promise.all([
        fetchJSON<MonthlySummaryDto>(`${API_BASE}/api/Analytics/monthly-summary?year=${year}&month=${month}`),
        fetchJSON<CategoryBreakdownItem[]>(`${API_BASE}/api/Analytics/categories-breakdown?year=${year}&month=${month}`),
        fetchJSON<PagedTx>(`${API_BASE}/api/Transactions?year=${year}&month=${month}&Page=${page}&PageSize=${pageSize}`),
        fetchJSON<CategoryDto[]>(`${API_BASE}/api/Categories`),
      ]);
      setSummary(sum); setCatsBreakdown(breakdown); setTx(txs); setCategories(cats);

      // Fetch all transactions for overall balance
      const allTx = await fetchJSON<PagedTx>(`${API_BASE}/api/Transactions?Page=1&PageSize=10000`);
      if (!allTx?.items) setOverallBalance(0);
      else setOverallBalance(allTx.items.reduce((acc, tx) => acc + Number(tx.amount), 0));
    } catch (e:any) { setError(e.message || String(e)); }
    finally { setLoading(false); }
  };

  // Load recurring transactions
  const loadRecurring = async () => {
    try { const items = await fetchJSON<RecurringDto[]>(`${API_BASE}/api/Recurring`); setRecurring(items); }
    catch(e:any){ setError(e.message || String(e)); }
  };

  // Load insights for the selected month
  const loadInsights = async () => {
    try { const data = await fetchJSON<any>(`${API_BASE}/api/Insights/monthly?year=${year}&month=${month}`); setInsights(data); }
    catch(e:any){ setError(e.message || String(e)); }
  };

  // Effects to load data on mount or when relevant state changes
  useEffect(()=>{ void load(); }, [year, month, page, pageSize]);
  useEffect(()=>{ if (tab==="recurring") void loadRecurring(); }, [tab]);
  useEffect(()=>{ if (tab==="insights") void loadInsights(); }, [tab, year, month]);

  // Pie chart data for category breakdown
  const pieData = useMemo(() => (catsBreakdown || [])
    .map(x => ({ name: x.categoryName ?? "?", value: x.expense ?? 0 }))
    .filter(d => d.value > 0), [catsBreakdown]);
  const totalExpense = summary?.expense ?? pieData.reduce((s,d)=>s+d.value,0);

  // Logout: remove token and go to login
  function handleLogout() {
    localStorage.removeItem("jwt");
    localStorage.removeItem("userEmail");
    try {
      navigate("/login", { replace: true });
    } catch {
      window.location.assign("/login");
    }
  }

  // ===== Transactions =====
  // Save a new transaction
  const saveTx = async () => {
    if (!txForm.amount || !txForm.date || !txForm.categoryId) { alert("חסר שדה בטופס התנועה"); return; }
    setCreatingTx(true);
    try {
      const payload = { amount: Number(txForm.amount), date: txForm.date, categoryId: Number(txForm.categoryId), note: txForm.note?.trim() || null };
      await fetchJSON(`${API_BASE}/api/Transactions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setTxForm({ amount: "", date: new Date().toISOString().slice(0,10), categoryId: "", note: "" });
      await load();
      (document.getElementById('dlg') as HTMLDialogElement | null)?.close();
    } catch(e:any){ alert(e.message || String(e)); }
    finally { setCreatingTx(false); }
  };

  // ===== Categories =====
  // Create a new category
  const createCategory = async () => {
    if (!catForm.name.trim()) { alert("צריך שם לקטגוריה"); return; }
    try {
      await fetchJSON(`${API_BASE}/api/Categories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: catForm.name.trim(), type: catForm.type }) });
      setCatForm({ name: "", type: "Expense" });
      (document.getElementById('catDlg') as HTMLDialogElement | null)?.close();
      await load();
    } catch (e:any) { alert(e.message || String(e)); }
  };

  // Delete a category
  const deleteCategory = async (id: number, name: string) => {
    if (name === "הכנסה" || name === "הוצאה") { alert("לא ניתן למחוק את הקטגוריה הזו"); return; }
    if (!confirm(`למחוק את הקטגוריה "${name}"?`)) return;
    try { await fetchJSON(`${API_BASE}/api/Categories/${id}`, { method: "DELETE" }); }
    catch (e:any) { alert(e.message || String(e)); }
    finally { await load(); }
  };

  // Delete a transaction
  const deleteTx = async (id: number) => {
    if (!confirm("למחוק את התנועה הזו?")) return;
    try {
      await fetchJSON(`${API_BASE}/api/Transactions/${id}`, { method: "DELETE", headers: authHeaders() });
      await load();
    } catch (e: any) {
      alert(e.message || String(e));
    }
  };

  // ===== Recurring =====
  // Add a new recurring transaction
  const addRecurring = async () => {
    const body = {
      categoryId: Number(recForm.categoryId),
      amount: Number(recForm.amount),
      cadence: recForm.cadence,
      interval: Number(recForm.interval || "1"),
      dayOfMonth: recForm.cadence === "monthly" ? Number(recForm.dayOfMonth || new Date().getUTCDate()) : undefined,
      startDate: recForm.startDate,
      note: recForm.note?.trim() || null,
    };
    try {
      await fetchJSON(`${API_BASE}/api/Recurring`, { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(body) });
      setRecForm(r=>({ ...r, amount: "", note: "" }));
      await loadRecurring();
    } catch (e:any) { alert(e.message || String(e)); }
  };

  // Delete a recurring transaction
  const deleteRecurring = async (id:number) => {
    if (!confirm("למחוק את התנועה הקבועה?")) return;
    try { await fetchJSON(`${API_BASE}/api/Recurring/${id}`, { method: "DELETE" }); await loadRecurring(); }
    catch (e:any) { alert(e.message || String(e)); }
  };

  // Run all due recurring transactions now
  const runRecurringNow = async () => {
    try {
      const res = await fetchJSON<{created:number, due:number}>(`${API_BASE}/api/Recurring/run-due`, { method: "POST" });
      alert(`בוצע. נוספו ${res?.created ?? 0} תנועות.`);
      await Promise.all([loadRecurring(), load()]);
    } catch (e:any) { alert(e.message || String(e)); }
  };

  // ===== Export =====
  // Download monthly transactions as Excel file
  const downloadExcel = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/Export/monthly.xlsx?year=${year}&month=${month}`, {
        headers: authHeaders()
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `budget-${year}-${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e:any) {
      alert(e.message || String(e));
    }
  };

  // ===== AI =====
  // Parse free text into transaction suggestion
  const parseFreeText = async () => {
    if (!freeText.trim()) return;
    try {
      const res = await fetchJSON<any>(`${API_BASE}/api/AI/parse`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: freeText }) });
      setParseResult(res);
      const s = res?.suggestion || {};
      setTxForm(f=>({ ...f,
        amount: s.amount != null ? String(s.amount) : f.amount,
        date: s.date || f.date,
        categoryId: s.categoryId != null ? String(s.categoryId) : f.categoryId,
        note: s.note || f.note,
      }));
      alert("מילאתי את טופס התנועה לפי הטקסט. בדוק ואַשר שמירה.");
      setTab("dashboard");
      (document.getElementById('dlg') as HTMLDialogElement | null)?.showModal();
    } catch (e:any) { alert(e.message || String(e)); }
  };

  // ===== Coach Advice =====
  // Get budget advice from AI
  const getCoachAdvice = async () => {
    try {
      const payload = {
        summary:  summary  || undefined,
        insights: insights || undefined,
        breakdown: breakdownForCoach.length
          ? breakdownForCoach.map(b => ({
              categoryId: b.categoryId,
              name: b.name,
              categoryName: b.name,
              type: b.type,
              total: b.total,
              totalSigned: b.total,
              count: b.count,
            }))
          : undefined,
      };

      const res  = await fetchJSON<any>(`${API_BASE}/api/AI/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const list = Array.isArray(res?.advice)
        ? res.advice
        : (typeof res?.advice === "string" ? String(res.advice).split(/\n+/) : []);
      setAdvice(list.slice(0, 5));
    } catch (e:any) {
      alert(e.message || String(e));
    }
  };

  // ===== Render =====
  return (
    <div>
      {/* Top bar */}
      <div className="header">
        <div className="header-wrap container">
          <div className="h1"> BudgetWise</div>
          <div className="flex" style={{ gap: 8, alignItems: "center" }}>
            <select className="select" value={month} onChange={(e)=>setMonth(Number(e.target.value))}>
              {Array.from({length:12}).map((_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}
            </select>
            <input className="input" type="number" value={year} onChange={(e)=>setYear(Number(e.target.value))} style={{width:92}} />
            <button className="btn" onClick={()=>void load()}><RefreshCw size={16} style={{marginInlineEnd:6}}/> רענן</button>
            <button className="btn" onClick={downloadExcel}>ייצוא לאקסל</button>

            <div className="flex" style={{ gap: 8}}>
              <button className={`btn ${tab==="dashboard"?"primary":""}`} onClick={()=>setTab("dashboard")}>דאשבורד</button>
              <button className={`btn ${tab==="recurring"?"primary":""}`} onClick={()=>setTab("recurring")}>תנועות קבועות</button>
              <button className={`btn ${tab==="insights"?"primary":""}`} onClick={()=>setTab("insights")}>תובנות</button>
              <button className={`btn ${tab==="ai"?"primary":""}`} onClick={()=>setTab("ai")}>AI</button>
              
            </div>
<CsvUploader
  onDataRefresh={load}
  categories={categories}
  apiBase={API_BASE}
  authHeaders={authHeaders}
/>
            <div style={{ marginInlineStart: "auto" }}>
              {isLoggedIn ? (
                <div className="flex" style={{ gap: 8, alignItems: "center" }}>
                  <span className="help">מחובר{userEmail?`: ${userEmail}`:""}</span>
                  <button className="btn" onClick={handleLogout}>התנתק</button>
                </div>
              ) : (
                <button className="btn" onClick={()=>setTab("auth")}>התחבר/הירשם</button>
              )}
            </div>

            <button className="btn primary" onClick={()=> (document.getElementById('dlg') as HTMLDialogElement | null)?.showModal()}>
              <Plus size={16} style={{marginInlineEnd:6}}/> תנועה חדשה
            </button>
          </div>
        </div>
      </div>

      <main className="container">
        {/* Errors */}
        {error && <div className="card"><div className="card-body" style={{color:"#b91c1c"}}>{error}</div></div>}

        {/* Tabs */}
        {tab === "dashboard" && (
          <>
            {/* KPI */}
            <div className="row">
              <div className="col-4"><div className="card"><div className="card-body"><div className="card-title">הכנסות חודשיות</div><div className="big">₪ {currency(summary?.income)}</div></div></div></div>
              <div className="col-4"><div className="card"><div className="card-body"><div className="card-title">הוצאות חודשיות</div><div className="big">₪ {currency(totalExpense)}</div></div></div></div>
              <div className="col-4"><div className="card"><div className="card-body"><div className="card-title">יתרה כוללת</div><div className={`big ${overallBalance < 0 ? 'bad':'ok'}`}>₪ {currency(overallBalance)}</div></div></div></div>
            </div>

            {/* Chart + Last transactions */}
            <div className="row">
              <div className="col-6">
                <div className="card"><div className="card-body" style={{height:340}}>
                  <div className="card-title">פירוק הוצאות לפי קטגוריה</div>
                  {loading ? (
                    <div className="flex" style={{height:"100%", justifyContent:"center"}}><Loader2 className="animate-spin" /></div>
                  ) : (
                    <ResponsiveContainer width="100%" height="85%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={110}>
                          {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v:number)=>`₪ ${currency(v)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  <div className="help">מציג סכום ההוצאות לפי קטגוריות בחודש שנבחר.</div>
                </div></div>
              </div>

              <div className="col-6">
                <div className="card"><div className="card-body">
                  <div className="card-title">תנועות החודש</div>
                  <div style={{overflowX:"auto"}}>
                    <table className="table">
                      <thead><tr><th>תאריך</th><th>קטגוריה</th><th>סכום</th><th>הערה</th><th></th></tr></thead>
                      <tbody>
                        {tx?.items?.map(t=>{
                          const c = categories.find(c=>c.id === t.categoryId);
                          const cls = t.amount < 0 ? "bad" : "ok";
                          return (
                            <tr key={t.id}>
                              <td>{t.date}</td>
                              <td>{c ? `${c.name} · ${c.type==="Income"?"הכנסה":"הוצאה"}` : t.categoryId}</td>
                              <td className={cls}>₪ {currency(t.amount)}</td>
                              <td title={t.note || ""} style={{maxWidth:280, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{t.note}</td>
                              <td>
                                <button className="btn" onClick={() => deleteTx(t.id)}>מחק</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex space-between mt-8">
                    <div className="help">סה"כ: {tx?.totalCount ?? 0}</div>
                    <div className="flex">
                      <button className="btn" disabled={(page||1)<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>הקודם</button>
                      <div className="help">עמוד {page}</div>
                      <button className="btn" disabled={!!tx && (page*pageSize)>=tx.totalCount} onClick={()=>setPage(p=>p+1)}>הבא</button>
                      <select className="select" value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(1); }}>
                        {[5,10,20,50].map(n=> <option key={n} value={n}>{n}/עמוד</option>)}
                      </select>
                    </div>
                  </div>
                </div></div>
              </div>
            </div>

            {/* Category management */}
            <div className="card" style={{ marginTop: 16 }}>
              <div className="flex space-between">
                <div style={{ fontWeight: 600 }}>קטגוריות</div>
                <button className="btn primary" onClick={() => (document.getElementById('catDlg') as HTMLDialogElement | null)?.showModal()}>
                  קטגוריה חדשה
                </button>
              </div>
              <div style={{ marginTop: 12 }}>
                <table className="table">
                  <thead><tr><th>שם</th><th>סוג</th><th style={{ width: 90 }}></th></tr></thead>
                  <tbody>
                    {categories.map(c => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.type === "Income" ? "הכנסה" : "הוצאה"}</td>
                        <td><button className="btn" onClick={() => void deleteCategory(c.id, c.name)}>מחק</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {categories.length === 0 && <div className="help">אין קטגוריות עדיין.</div>}
              </div>
            </div>
          </>
        )}

        {tab === "recurring" && (
          <div className="card">
            <div className="card-body">
              <div className="card-title">תנועות קבועות</div>
              <div className="flex" style={{ gap: 8, flexWrap: "wrap" }}>
                <select className="select" value={recForm.categoryId} onChange={(e)=>setRecForm(r=>({...r, categoryId: e.target.value}))}>
                  <option value="" disabled>קטגוריה</option>
                  {categories.map(c=> <option key={c.id} value={c.id}>{c.name} · {c.type==="Income"?"הכנסה":"הוצאה"}</option>)}
                </select>
                <input className="input" placeholder="סכום" type="number" value={recForm.amount} onChange={(e)=>setRecForm(r=>({...r, amount: e.target.value }))} />
                <select className="select" value={recForm.cadence} onChange={(e)=>setRecForm(r=>({...r, cadence: e.target.value as Cadence}))}>
                  <option value="daily">יומי</option>
                  <option value="weekly">שבועי</option>
                  <option value="monthly">חודשי</option>
                </select>
                <input className="input" style={{width:80}} type="number" value={recForm.interval} onChange={(e)=>setRecForm(r=>({...r, interval: e.target.value }))} />
                {recForm.cadence === "monthly" && (
                  <input className="input" style={{width:100}} type="number" placeholder="יום בחודש" value={recForm.dayOfMonth} onChange={(e)=>setRecForm(r=>({...r, dayOfMonth: e.target.value }))} />
                )}
                <input className="input" type="date" value={recForm.startDate} onChange={(e)=>setRecForm(r=>({...r, startDate: e.target.value }))} />
                <input className="input" placeholder="הערה" value={recForm.note} onChange={(e)=>setRecForm(r=>({...r, note: e.target.value }))} />
                <button className="btn primary" onClick={addRecurring}>הוסף</button>
                <button className="btn" onClick={runRecurringNow}>הרץ עכשיו</button>
              </div>

              <div style={{ marginTop: 16, overflowX:"auto" }}>
                <table className="table">
                  <thead><tr><th>קטגוריה</th><th>סכום</th><th>מחזוריות</th><th>הפעלה הבאה</th><th></th></tr></thead>
                  <tbody>
                    {recurring.map(r=>{
                      const c = categories.find(c=>c.id===r.categoryId);
                      return (
                        <tr key={r.id}>
                          <td>{c ? `${c.name} · ${c.type==="Income"?"הכנסה":"הוצאה"}` : r.categoryId}</td>
                          <td>₪ {currency(r.amount)}</td>
                          <td>{r.cadence}/{r.interval}{r.cadence==="monthly" && r.dayOfMonth?` (יום ${r.dayOfMonth})`:""}</td>
                          <td>{r.nextRunDate}</td>
                          <td><button className="btn" onClick={()=>deleteRecurring(r.id)}>מחק</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {recurring.length===0 && <div className="help">אין תנועות קבועות עדיין.</div>}
              </div>
            </div>
          </div>
        )}

        {tab === "insights" && (
          <div className="card">
            <div className="card-body">
              <div className="card-title">תובנות חודשיות</div>
              {insights ? (
                <>
                  <div className="row">
                    <div className="col-3"><div className="card"><div className="card-body"><div className="card-title">הכנסות</div><div className="big">₪ {currency(insights.income)}</div></div></div></div>
                    <div className="col-3"><div className="card"><div className="card-body"><div className="card-title">הוצאות</div><div className="big">₪ {currency(insights.expense)}</div></div></div></div>
                    <div className="col-3"><div className="card"><div className="card-body"><div className="card-title">נטו</div><div className={`big ${((insights.net ?? 0) < 0) ? 'bad':'ok'}`}>₪ {currency(insights.net)}</div></div></div></div>
                    {insights.projectedNet!=null && (
                      <div className="col-3"><div className="card"><div className="card-body"><div className="card-title">חיזוי סוף חודש</div><div className={`big ${((insights.projectedNet ?? 0) < 0) ? 'bad':'ok'}`}>₪ {currency(insights.projectedNet)}</div></div></div></div>
                    )}
                  </div>

                  {Array.isArray(insights.spikes) && insights.spikes.length>0 && (
                    <div className="card" style={{ marginTop: 12 }}>
                      <div className="card-body">
                        <div className="card-title">קפיצות בהוצאות</div>
                        <ul>
                          {insights.spikes.map((s:any, i:number)=> (
                            <li key={i}>קטגוריה #{s.categoryId}: נוכחי ₪{currency(s.current)} מול ממוצע 3 חודשים ₪{currency(s.avg3m)} ×{s.factor}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  <button className="btn" onClick={getCoachAdvice}>קבל עצות</button>
                  {advice && advice.length>0 && (
                    <div className="card" style={{ marginTop: 12 }}>
                      <div className="card-body">
                        <div className="card-title">עצות</div>
                        <ul>{advice.map((a,i)=><li key={i}>{a}</li>)}</ul>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="help">טוען תובנות...</div>
              )}
            </div>
          </div>
        )}

        {tab === "ai" && (
          <div className="card">
            <div className="card-body">
              <div className="card-title">הוסף תנועה מטקסט חופשי</div>
              <div className="flex" style={{ gap: 8 }}>
                <input className="input" placeholder="לדוגמה: קניתי בסופר 120 אתמול" value={freeText} onChange={(e)=>setFreeText(e.target.value)} />
                <button className="btn primary" onClick={parseFreeText}>נתח טקסט</button>
              </div>
              {parseResult && (
                <div className="help" style={{ marginTop: 8 }}>הצעה: {JSON.stringify(parseResult.suggestion)}</div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* דיאלוג – תנועה חדשה */}
      <dialog id="dlg" className="dialog">
        <form method="dialog">
          <div className="dlg-title">הוספת תנועה</div>
          <div className="dlg-body">
            <div>
              <div className="help">סכום</div>
              <input className="input" type="number" inputMode="decimal" value={txForm.amount} onChange={(e)=>setTxForm(f=>({...f, amount:e.target.value}))} />
            </div>
            <div>
              <div className="help">תאריך</div>
              <input className="input" type="date" value={txForm.date} onChange={(e)=>setTxForm(f=>({...f, date:e.target.value}))} />
            </div>
            <div>
              <div className="help">קטגוריה</div>
              <select className="select" value={txForm.categoryId} onChange={(e)=>setTxForm(f=>({...f, categoryId:e.target.value}))}>
                <option value="" disabled>בחר קטגוריה</option>
                {categories.map(c=> <option key={c.id} value={c.id}>{c.name} · {c.type==="Income"?"הכנסה":"הוצאה"}</option>)}
              </select>
            </div>
            <div>
              <div className="help">הערה (אופציונלי)</div>
              <input className="input" value={txForm.note} onChange={(e)=>setTxForm(f=>({...f, note:e.target.value}))} />
            </div>
          </div>
          <div className="dlg-actions">
            <button className="btn" onClick={()=> (document.getElementById('dlg') as HTMLDialogElement | null)?.close() }>סגירה</button>
            <button type="button" className="btn primary" disabled={creatingTx} onClick={()=>void saveTx()}>
              {creatingTx ? <Loader2 className="animate-spin" size={16}/> : null} שמירה
            </button>
          </div>
        </form>
      </dialog>

      {/* דיאלוג – קטגוריה חדשה */}
      <dialog id="catDlg" className="dialog">
        <form method="dialog">
          <div className="dlg-title">קטגוריה חדשה</div>
          <div className="dlg-body">
            <div>
              <div className="help">שם</div>
              <input className="input" value={catForm.name} onChange={(e)=>setCatForm(f=>({...f, name: e.target.value}))} placeholder="לדוג׳: סופר, דלק, שכר דירה" />
            </div>
            <div>
              <div className="help">סוג</div>
              <select className="select" value={catForm.type} onChange={(e)=>setCatForm(f=>({...f, type: e.target.value as CategoryType}))}>
                <option value="Expense">הוצאה</option>
                <option value="Income">הכנסה</option>
              </select>
            </div>
          </div>
          <div className="dlg-actions">
            <button className="btn" onClick={()=> (document.getElementById('catDlg') as HTMLDialogElement | null)?.close() }>סגירה</button>
            <button type="button" className="btn primary" onClick={()=>void createCategory()}>שמירה</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}