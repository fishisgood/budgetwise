// src/main.tsx
import ReactDOM from "react-dom/client";
import App from "./App";
import "./setupAuthFetch";
import "./index.css";
import { AuthProvider } from "./auth/AuthContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
