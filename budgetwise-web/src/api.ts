import { useAuth } from "./auth/AuthContext";

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("jwt");
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", headers.get("Content-Type") || "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) {
    // token לא תקין / פג תוקף
    localStorage.removeItem("jwt");
    localStorage.removeItem("user");
    // רידיירקט למסך התחברות
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  return res;
}
