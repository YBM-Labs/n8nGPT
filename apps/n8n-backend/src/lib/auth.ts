import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db.js";
import { emailOTP } from "better-auth/plugins/email-otp";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    // Require verification to allow sign-in; we will handle it via Email OTP
    requireEmailVerification: true,
  },
  socialProviders: {
    // Intentionally empty for now; enable Google later
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
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
  trustedOrigins: ["*"],
  plugins: [
    emailOTP({
      // Send a 6-digit OTP to the user's email. We'll plug a provider later.
      async sendVerificationOTP({ email, otp, type }) {
        // TODO: integrate email provider (e.g., Resend, SendGrid, SES)
        // Example:
        // await sendEmail({ to: email, subject: `Your ${type} code`, text: `Code: ${otp}` })
        console.log("[email-otp] sendVerificationOTP", { email, otp, type });
      },
      otpLength: 6,
      expiresIn: 60 * 5, // 5 minutes
      // We rely on Better Auth's default verification trigger (requireEmailVerification)
      // which is overridden to OTP by this plugin. Avoid double sends here.
      sendVerificationOnSignUp: false,
      overrideDefaultEmailVerification: true,
      allowedAttempts: 3,
      // storeOTP: "hashed", // optionally enable when you add hashing helpers
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = (typeof auth.$Infer.Session)["user"];
