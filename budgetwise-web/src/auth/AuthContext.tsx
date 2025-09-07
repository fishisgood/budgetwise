import React, { createContext, useContext, useEffect, useState } from "react";

type User = { id: string; email: string; name?: string | null };
type AuthCtx = {
  user: User | null;
  token: string | null;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string, name?: string): Promise<void>;
  logout(): void;
};

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("jwt"));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (token) localStorage.setItem("jwt", token);
    else localStorage.removeItem("jwt");
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  async function login(email: string, password: string) {
    const r = await fetch("/api/Auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!r.ok) throw new Error("Login failed");
    const data = await r.json();
    setToken(data.token);
    setUser(data.user);
  }

  async function register(email: string, password: string, name?: string) {
    const r = await fetch("/api/Auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name })
    });
    if (!r.ok) throw new Error("Registration failed");
    const data = await r.json();
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return <Ctx.Provider value={{ user, token, login, register, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() { return useContext(Ctx); }
