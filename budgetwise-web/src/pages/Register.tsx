import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../index.css";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const res = await fetch("/api/Auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      localStorage.setItem("jwt", data.token);
      localStorage.setItem("userEmail", email);
      navigate("/login", { replace: true });
    } catch (e: any) {
      setErr(e.message || "שגיאה בהרשמה");
    }
  };

  return (
    <div className="row" style={{ justifyContent: "center", minHeight: "70vh", alignItems: "center" }}>
      <div className="col-4" style={{ maxWidth: 420 }}>
        <div className="card">
          <div className="card-body">
            <div className="card-title">הרשמה</div>
            {err && <div className="help" style={{ color: "#dc2626", whiteSpace: "pre-wrap" }}>{err}</div>}

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
              <div>
                <label className="help">אימייל</label>
                <input
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="help">סיסמה</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className="btn primary" style={{ width: "100%" }}>
                הרשם
              </button>
            </form>

            <div className="help" style={{ marginTop: 12 }}>
              כבר רשום?{" "}
              <Link to="/login">להתחברות</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
