import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL:
    import.meta.env.VITE_NODE_ENV === "dev"
      ? "http://localhost:5000"
      : "https://api.n8ngpt.ybmlabs.com",
  plugins: [emailOTPClient()],
});
