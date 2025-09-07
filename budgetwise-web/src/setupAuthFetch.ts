// src/setupAuthFetch.ts
// גרסה "עמידה" ל-TypeScript: בלי חתימות מסובכות
const originalFetch = window.fetch.bind(window);

(window as any).fetch = async (input: any, init?: any) => {
  let url = typeof input === "string" ? input : input?.url || "";
  const headers = new Headers(init?.headers || {});
  const token = localStorage.getItem("jwt");

  if (token && typeof url === "string" && url.startsWith("/api")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return originalFetch(input, { ...init, headers });
};
