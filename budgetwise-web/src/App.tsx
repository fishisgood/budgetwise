// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute";
import BudgetWiseDashboard from "./BudgetWiseDashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";

function LayoutWithHeader() {
  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <BudgetWiseDashboard />
    </div>
  );
}

export default function App() {
  const hasToken = !!localStorage.getItem("jwt");
  return (
    <BrowserRouter>
      <Routes>
        {/* ברירת מחדל: אם אין טוקן — ל־/login, אחרת ל־/app */}
        <Route path="/" element={<Navigate to={hasToken ? "/app" : "/login"} replace />} />

        {/* מסכים פתוחים */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* אזור מוגן */}
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <LayoutWithHeader />
            </ProtectedRoute>
          }
        />

        {/* פולבאק לנתיב לא קיים */}
        <Route path="*" element={<Navigate to={hasToken ? "/app" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
