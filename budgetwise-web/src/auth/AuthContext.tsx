import React, { createContext, useContext, useEffect, useState } from "react";

// Type definition for the user object
type User = { id: string; email: string; name?: string | null };

// Type definition for the authentication context
type AuthCtx = {
  user: User | null; // Current user info
  token: string | null; // JWT token
  login(email: string, password: string): Promise<void>; // Login function
  register(email: string, password: string, name?: string): Promise<void>; // Register function
  logout(): void; // Logout function
};

// Create the authentication context
const Ctx = createContext<AuthCtx>(null as any);

// Helper function to check if a JWT token is expired
function isTokenExpired(token: string | null): boolean {
  if (!token || token.split(".").length !== 3) return true; // Check for valid JWT format
  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(atob(payload)); // Decode the payload
    return decoded.exp * 1000 < Date.now(); // Compare expiration time to current time
  } catch {
    return true; // If decoding fails, treat as expired
  }
}

// AuthProvider component wraps the app and provides authentication state and functions
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize token state from localStorage, remove if expired
  const [token, setToken] = useState<string | null>(() => {
    const t = localStorage.getItem("jwt");
    if (!t || isTokenExpired(t)) {
      localStorage.removeItem("jwt");
      return null;
    }
    return t;
  });

  // Initialize user state from localStorage
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  // Sync authentication state across browser tabs/windows
  useEffect(() => {
    function syncAuth(e: StorageEvent) {
      if (e.key === "jwt") {
        setToken(e.newValue && !isTokenExpired(e.newValue) ? e.newValue : null);
      }
      if (e.key === "user") {
        setUser(e.newValue ? JSON.parse(e.newValue) : null);
      }
    }
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  // Update localStorage when token changes
  useEffect(() => {
    if (token) localStorage.setItem("jwt", token);
    else localStorage.removeItem("jwt");
  }, [token]);

  // Update localStorage when user changes
  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  // Login function: sends credentials to backend, updates state on success
  async function login(email: string, password: string) {
    const r = await fetch("/api/Auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!r.ok) throw new Error("Login failed");
    const data = await r.json();
    setToken(data.token); // Save JWT token
    setUser(data.user);   // Save user info
  }

  // Register function: sends registration data to backend, updates state on success
  async function register(email: string, password: string, name?: string) {
    const r = await fetch("/api/Auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name })
    });
    if (!r.ok) throw new Error("Registration failed");
    const data = await r.json();
    setToken(data.token); // Save JWT token
    setUser(data.user);   // Save user info
  }

  // Logout function: clears token and user from state and localStorage
  function logout() {
    setToken(null);
    setUser(null);
  }

  // Provide authentication state and functions to child components
  return <Ctx.Provider value={{ user, token, login, register, logout }}>{children}</Ctx.Provider>;
}

// Custom hook to access authentication context
export function useAuth() { return useContext(Ctx); }