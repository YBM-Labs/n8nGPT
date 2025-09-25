import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (email: string, otp: string, type: string) => {
  try {
    let emailData;

    const fromEmail = "notifications@n8ngpt.ybmlabs.com";

    if (type === "sign-in") {
      emailData = {
        from: fromEmail,
        to: email,
        subject: "Sign in OTP - n8nGPT",
        html: `<p>Your OTP for sign in is <strong>${otp}</strong></p>`,
      };
    } else if (type === "email-verification") {
      emailData = {
        from: fromEmail,
        to: email,
        subject: "Email Verification OTP - n8nGPT",
        html: `<p>Your OTP for email verification is <strong>${otp}</strong></p>`,
      };
    } else if (type === "password-reset" || type === "forget-password") {
      emailData = {
        from: fromEmail,
        to: email,
        subject: "Password Reset OTP - n8nGPT",
        html: `<p>Your OTP for password reset is <strong>${otp}</strong></p>`,
      };
    } else {
      throw new Error(`Invalid email type: ${type}`);
    }

    const result = await resend.emails.send(emailData);

    if (result.error) {
      console.error(`[${type}] Resend API error:`, result.error);
      throw new Error(`Failed to send email: ${result.error.message}`);
    }
    return result;
  } catch (error) {
    console.error(`[${type}] Error sending email to ${email}:`, error);
    throw error;
  }
};
