// setupAuthFetch.ts
// This file monkey-patches the global fetch function to automatically add the JWT token
// from localStorage as an Authorization header for API requests starting with "/api".
// This ensures all authenticated requests include the token without manual intervention.

const originalFetch = window.fetch.bind(window); // Save the original fetch function

// Override the global fetch function
(window as any).fetch = async (input: any, init?: any) => {
  // Determine the request URL
  let url = typeof input === "string" ? input : input?.url || "";
  // Clone and normalize headers from the request
  const headers = new Headers(init?.headers || {});
  // Get the JWT token from localStorage
  const token = localStorage.getItem("jwt");

  // If a token exists and the request is to the API, add the Authorization header
  if (token && typeof url === "string" && url.startsWith("/api")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Call the original fetch with updated headers
  return originalFetch(input, { ...init, headers });
};