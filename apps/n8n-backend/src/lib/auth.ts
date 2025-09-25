import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db.js";
import { emailOTP } from "better-auth/plugins/email-otp";
import { sendEmail } from "./resend.js";

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
        await sendEmail(email, otp, type);
        console.log("[email-otp] sendVerificationOTP", { email, otp, type });
      },
      otpLength: 6,
      expiresIn: 60 * 5, // 5 minutes
     
      sendVerificationOnSignUp: false,
      overrideDefaultEmailVerification: true,
      allowedAttempts: 3,
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = (typeof auth.$Infer.Session)["user"];
