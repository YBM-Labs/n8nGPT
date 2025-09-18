import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.NODE_ENV === "dev" ? "http://localhost:5000" : "https://api.n8ngpt.ybmlabs.com",
});
