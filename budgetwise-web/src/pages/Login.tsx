import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation() as any;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    try {
      const res = await fetch("/api/Auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      localStorage.setItem("jwt", data.token);
      localStorage.setItem("userEmail", email);
      const to = location.state?.from?.pathname || "/app";
      navigate(to, { replace: true });
    } catch (e: any) {
      setErr(e.message || "שגיאה בהתחברות");
    }
  };

  return (

    <div className="row" style={{ justifyContent: "center", minHeight: "70vh", alignItems: "center" }}>
      <div className="col-4" style={{ maxWidth: 420 }}>
        <div className="card">
          <div className="card-body">
            <div className="card-title">התחברות</div>
            {err && <div className="help" style={{ color: "#dc2626", whiteSpace: "pre-wrap" }}>{err}</div>}

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
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
                  autoComplete="current-password"
                />
              </div>
              <button type="submit" className="btn primary" style={{ width: "100%" }}>
                התחבר
              </button>
            </form>

            <div className="help" style={{ marginTop: 12 }}>
              אין חשבון?{" "}
              <Link to="/register">להרשמה</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}