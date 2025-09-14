// CSV Uploader component for importing bank statement transactions
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

// ===== Types =====
interface Category {
  id: number;
  name: string;
  type: 'Income' | 'Expense';
}

interface UploadTransaction {
  originalRowIndex: number;
  suggestion: {
    amount: number;
    date: string;
    categoryId: number | null;
    note: string;
  };
}

interface UploadResult {
  transactions: UploadTransaction[];
  summary: {
    headerRowIndex: number;
    confidence: number;
  };
}

interface CsvUploaderProps {
  onDataRefresh: () => Promise<void>;
  categories: Category[];
  apiBase: string;
  authHeaders: (init?: RequestInit) => Headers;
}

// ===== Utils =====
// Format currency for display
const currency = (x?: unknown) => {
  const n = typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN;
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "–";
};

// ===== CSV Uploader Component =====
export default function CsvUploader({ onDataRefresh, categories, apiBase, authHeaders }: CsvUploaderProps) {
  // State for file upload and dialog
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showDialog, setShowDialog] = useState(false);

  // Helper for fetch with auth
  async function fetchJSON<T = any>(url: string, init?: RequestInit): Promise<T> {
    const r = await fetch(url, { ...init, headers: authHeaders(init) });
    if (!r.ok) throw new Error(await r.text());
    if (r.status === 204) return null as unknown as T;
    return r.json();
  }

  // Handle file upload and analysis
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await fetchJSON(`${apiBase}/api/upload/excel`, {
        method: "POST",
        body: formData,
        headers: authHeaders()
      });
      setUploadResult(result);

      // Select all by default
      const allIndices = new Set<number>((result.transactions?.map((_: any, i: number) => i) || []) as number[]);
      setSelectedTransactions(allIndices);

      setShowDialog(true); // Show modal dialog
      alert(`נותחו ${result.transactions?.length || 0} תנועות. בדוק ואשר למטה.`);
    } catch (e: any) {
      alert(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Toggle selection for a transaction
  const toggleTransaction = (index: number) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTransactions(newSelected);
  };

  // Toggle select all
  const toggleAll = () => {
    if (selectedTransactions.size === uploadResult?.transactions?.length) {
      setSelectedTransactions(new Set());
    } else {
      const allIndices = new Set<number>((uploadResult?.transactions?.map((_: any, i: number) => i) || []) as number[]);
      setSelectedTransactions(allIndices);
    }
  };

  // Start editing a transaction
  const startEdit = (index: number, suggestion: any) => {
    setEditingIndex(index);
    setEditForm({
      amount: suggestion.amount || '',
      date: suggestion.date || '',
      categoryId: suggestion.categoryId || '',
      note: suggestion.note || ''
    });
  };

  // Save edited transaction
  const saveEdit = () => {
    if (editingIndex === null) return;

    // Update the transaction in uploadResult
    const newResult = { ...uploadResult! };
    newResult.transactions[editingIndex].suggestion = {
      ...newResult.transactions[editingIndex].suggestion,
      ...editForm,
      amount: Number(editForm.amount) || 0,
      categoryId: editForm.categoryId ? Number(editForm.categoryId) : null
    };

    setUploadResult(newResult);
    setEditingIndex(null);
    setEditForm({});
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingIndex(null);
    setEditForm({});
  };

  // Save selected transactions to backend
  const saveSelected = async () => {
    if (!uploadResult?.transactions) return;

    setSaving(true);
    try {
      const selectedTxs = uploadResult.transactions
        .filter((_: any, i: number) => selectedTransactions.has(i))
        .map((tx: any) => {
          let catId = tx.suggestion.categoryId;
          // If categoryId is missing or invalid, assign fallback by amount sign
          if (!categories.some(c => c.id === catId)) {
            if (tx.suggestion.amount > 0) {
              catId = categories.find(c => c.type === "Income")?.id ?? null;
            } else if (tx.suggestion.amount < 0) {
              catId = categories.find(c => c.type === "Expense")?.id ?? null;
            }
          }
          return { ...tx.suggestion, categoryId: catId };
        })
        .filter((tx: any) => tx.categoryId && typeof tx.amount === "number" && tx.amount !== 0);

      if (selectedTxs.length === 0) {
        alert("אין תנועות תקינות לשמירה. וודא שכל התנועות כוללות קטגוריה תקינה וסכום שונה מאפס.");
        return;
      }

      let saved = 0;
      for (const tx of selectedTxs) {
        const payload = {
          amount: Number(tx.amount),
          date: tx.date,
          categoryId: Number(tx.categoryId),
          note: (tx.note?.trim() || "").slice(0, 255)
        };
        await fetchJSON(`${apiBase}/api/Transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(payload)
        });
        saved++;
      }

      alert(`נשמרו ${saved} תנועות בהצלחה!`);
      await onDataRefresh();
      setUploadResult(null);
      setSelectedTransactions(new Set());
      setFile(null);
      setShowDialog(false);
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Close dialog and reset state
  const closeDialog = () => {
    setShowDialog(false);
    setUploadResult(null);
    setSelectedTransactions(new Set());
    setEditingIndex(null);
    setEditForm({});
    setFile(null);
  };

  // ===== Render =====

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {/* Hidden file input */}
        <input
          id="file-upload"
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: "none" }}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {/* Custom button */}
        <button
          className="btn"
          type="button"
          onClick={() => document.getElementById("file-upload")?.click()}
          id="file-upload-button"
        >
          בחר קובץ
        </button>
        {/* Show selected file name or placeholder */}
        <span className="help">
          {file ? file.name : "לא נבחר קובץ"}
        </span>
        <button
          className="btn primary"
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? <Loader2 className="animate-spin" size={16}/> : null}
          {uploading ? "מעלה..." : "נתח קובץ"}
        </button>
      </div>
      {showDialog && uploadResult && (
        <div
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.15)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            className="card"
            style={{
              position: "relative",
              width: "min(900px, 95vw)",
              maxWidth: "95vw",
              maxHeight: "90vh",
              margin: "auto",
              background: "#fff",
              boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
              boxSizing: "border-box",
              padding: 24,
              overflow: "hidden"
            }}
          >
            {/* Close button */}
            <button
              onClick={closeDialog}
              style={{
                position: "absolute",
                top: 8,
                right: 12,
                background: "transparent",
                border: "none",
                fontSize: 22,
                color: "#888",
                cursor: "pointer",
                zIndex: 10
              }}
              aria-label="סגור"
            >
              ✕
            </button>
            <div
              className="card-body"
              style={{
                maxHeight: "75vh",
                overflowY: "auto"
              }}
            >
              <div className="card-title">
                תוצאות ניתוח - {uploadResult.transactions?.length || 0} תנועות נמצאו
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <div className="help">
                  נתח את השורה {uploadResult.summary?.headerRowIndex} ככותרות
                  | ביטחון: {Math.round((uploadResult.summary?.confidence || 0) * 100)}%
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="btn" onClick={toggleAll}>
                    {selectedTransactions.size === uploadResult.transactions?.length ? "בטל הכל" : "בחר הכל"}
                  </button>
                  <button 
                    className="btn primary" 
                    onClick={saveSelected}
                    disabled={selectedTransactions.size === 0 || saving}
                  >
                    {saving ? <Loader2 className="animate-spin" size={16}/> : null}
                    שמור {selectedTransactions.size} תנועות נבחרות
                  </button>
                </div>
              </div>

              <div style={{ maxHeight: 500, overflowY: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>✓</th>
                      <th>תאריך</th>
                      <th>סכום</th>
                      <th>תיאור</th>
                      <th>קטגוריה</th>
                      <th>מקור</th>
                      <th>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadResult.transactions?.map((tx: any, i: number) => {
                      const suggestion = tx.suggestion;
                      const category = categories.find(c => c.id === suggestion?.categoryId);
                      const isSelected = selectedTransactions.has(i);
                      const isEditing = editingIndex === i;
                      
                      return (
                        <tr 
                          key={i} 
                          style={{ 
                            backgroundColor: isSelected ? "#f0f9ff" : "transparent",
                            opacity: isSelected ? 1 : 0.7 
                          }}
                        >
                          <td>
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleTransaction(i)}
                            />
                          </td>
                          
                          {isEditing ? (
                            <>
                              <td>
                                <input 
                                  type="date" 
                                  value={editForm.date || ''} 
                                  onChange={(e) => setEditForm((f: any) => ({...f, date: e.target.value}))}
                                  style={{ width: '120px' }}
                                />
                              </td>
                              <td>
                                <input 
                                  type="number" 
                                  value={editForm.amount || ''} 
                                  onChange={(e) => setEditForm((f: any) => ({...f, amount: e.target.value}))}
                                  style={{ width: '80px' }}
                                />
                              </td>
                              <td>
                                <input 
                                  type="text" 
                                  value={editForm.note || ''} 
                                  onChange={(e) => setEditForm((f: any) => ({...f, note: e.target.value}))}
                                  style={{ width: '150px' }}
                                />
                              </td>
                              <td>
                                <select 
                                  value={editForm.categoryId || ''} 
                                  onChange={(e) => setEditForm((f: any) => ({...f, categoryId: e.target.value}))}
                                  style={{ width: '120px' }}
                                >
                                  <option value="">בחר קטגוריה</option>
                                  {categories.map(c => (
                                    <option key={c.id} value={c.id}>
                                      {c.name} ({c.type === "Income" ? "הכנסה" : "הוצאה"})
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="help">שורה {tx.originalRowIndex + 1}</td>
                              <td>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="btn" onClick={saveEdit} style={{ fontSize: '12px', padding: '2px 6px' }}>
                                    ✓
                                  </button>
                                  <button className="btn" onClick={cancelEdit} style={{ fontSize: '12px', padding: '2px 6px' }}>
                                    ✕
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{suggestion?.date}</td>
                              <td className={suggestion?.amount < 0 ? "bad" : "ok"}>
                                ₪ {currency(suggestion?.amount)}
                              </td>
                              <td title={suggestion?.note}>
                                {String(suggestion?.note || "").substring(0, 30)}
                                {String(suggestion?.note || "").length > 30 ? "..." : ""}
                              </td>
                              <td style={{ color: !category ? '#dc2626' : 'inherit' }}>
                                {category
                                  ? `${category.name} (${category.type === "Income" ? "הכנסה" : "הוצאה"})`
                                  : suggestion?.categoryId
                                    ? (suggestion.amount > 0
                                        ? "הכנסה"
                                        : suggestion.amount < 0
                                          ? "הוצאה"
                                          : "⚠️ לא זוהה")
                                    : "⚠️ לא זוהה"}
                              </td>
                              <td className="help">שורה {tx.originalRowIndex + 1}</td>
                              <td>
                                <button 
                                  className="btn" 
                                  onClick={() => startEdit(i, suggestion)}
                                  style={{ fontSize: '12px', padding: '2px 6px' }}
                                >
                                  ✏️
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}