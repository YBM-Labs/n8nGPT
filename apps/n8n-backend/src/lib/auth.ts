import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db.js";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true for production
  },
  socialProviders: {
    // Intentionally empty for now; enable Google later
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
  },
  trustedOrigins: [
    "http://localhost:5000",
    "chrome-extension://nipieiibjpnednoffcjnjdgmbfdnencb",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = (typeof auth.$Infer.Session)["user"];
