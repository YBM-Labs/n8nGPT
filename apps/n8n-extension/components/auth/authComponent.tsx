import { authClient } from "@/lib/auth-client";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { browser } from "wxt/browser";

export default function AuthPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [awaitingPasswordReset, setAwaitingPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const { data: session, isPending } = authClient.useSession();

  // Animate form entrance
  useEffect(() => {
    const timer = setTimeout(() => setShowForm(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Form validation
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError("Email is required");
      return false;
    }
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validatePassword = (password: string) => {
    if (!password) {
      setPasswordError("Password is required");
      return false;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const validateNewPassword = (password: string) => {
    if (!password) {
      setNewPasswordError("Password is required");
      return false;
    }
    if (password.length < 6) {
      setNewPasswordError("Password must be at least 6 characters");
      return false;
    }
    if (confirmPassword && password !== confirmPassword) {
      setNewPasswordError("Passwords do not match");
      return false;
    }
    setNewPasswordError("");
    return true;
  };

  const sendPasswordResetOtp = async () => {
    const emailToUse = forgotPasswordEmail || email;
    if (!validateEmail(emailToUse)) {
      setMessage("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      // Use the official better-auth method for sending forget-password OTP
      const { error } = await authClient.forgetPassword.emailOtp({
        email: emailToUse,
      });

      if (error) {
        setMessage(`Failed to send reset code: ${error.message}`);
      } else {
        setAwaitingPasswordReset(true);
        setMessage(
          "We sent a password reset code to your email. Enter it below."
        );
      }
    } catch (err) {
      setMessage("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async () => {
    const emailToUse = forgotPasswordEmail || email;
    if (!validateEmail(emailToUse)) return;
    if (!otp || otp.length < 4) {
      setMessage("Enter the verification code we emailed you");
      return;
    }
    if (!validateNewPassword(newPassword)) return;
    if (newPassword !== confirmPassword) {
      setNewPasswordError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      // Use the official better-auth resetPassword method with OTP
      const { error } = await authClient.emailOtp.resetPassword({
        email: emailToUse,
        otp,
        password: newPassword,
      });

      if (error) {
        setMessage(`Password reset failed: ${error.message}`);
      } else {
        setMessage(
          "Password reset successfully! You can now sign in with your new password."
        );
        // Reset the form
        setShowForgotPassword(false);
        setAwaitingPasswordReset(false);
        setOtp("");
        setNewPassword("");
        setConfirmPassword("");
        setForgotPasswordEmail("");
      }
    } catch (err) {
      setMessage("Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async () => {
    if (!validateEmail(email) || !validatePassword(password)) return;

    setIsLoading(true);
    setMessage("");

    try {
      const { error } = await authClient.signUp.email({
        email,
        password,
        name: email.split("@")[0] || "user",
      });

      if (error) {
        setMessage(`Sign up failed: ${error.message}`);
      } else {
        // Server (email-otp plugin) overrides default email verification
        // and sends OTP automatically when verification is required.
        setAwaitingOtp(true);
        setMessage(
          "We sent a verification code to your email. Enter it below."
        );
      }
    } catch (err) {
      setMessage("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async () => {
    if (!validateEmail(email) || !validatePassword(password)) return;

    setIsLoading(true);
    setMessage("");

    try {
      const { error } = await authClient.signIn.email({ email, password });
      setMessage(
        error ? `Sign in failed: ${error.message}` : "Welcome back! 👋"
      );
    } catch (err) {
      setMessage("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEmailWithOtp = async () => {
    if (!validateEmail(email)) return;
    if (!otp || otp.length < 4) {
      setMessage("Enter the verification code we emailed you");
      return;
    }

    setIsLoading(true);
    setMessage("");
    try {
      const { data, error } = await authClient.emailOtp.verifyEmail({
        email,
        otp,
      });
      if (error) {
        setMessage(error.message ?? "Verification failed");
      } else if (data?.status) {
        setMessage("Email verified! Signing you in...");
        setAwaitingOtp(false);
        // Automatically sign in using the provided password
        try {
          const { error: signInError } = await authClient.signIn.email({
            email,
            password,
          });
          if (signInError) {
            setMessage(
              signInError.message ?? "Signed in failed after verification"
            );
          } else {
            setMessage("");
          }
        } catch (e) {
          setMessage("Signed in failed after verification");
        }
      } else {
        setMessage("Invalid or expired code");
      }
    } catch (e) {
      setMessage("Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  async function signInWithGoogle() {
    setIsLoading(true);
    setMessage("");

    try {
      const { data, error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: "chrome-extension://" + browser.runtime.id,
        disableRedirect: true,
      });

      if (error) {
        setMessage(`Google sign-in failed: ${error.message}`);
        return;
      }

      if (data?.url) {
        browser.windows.create({
          url: data.url,
          type: "popup",
          width: 500,
          height: 600,
        });
        setMessage("Opening Google sign-in...");
      } else {
        setMessage("Failed to initiate Google sign-in");
      }
    } catch (err) {
      setMessage("An unexpected error occurred during Google sign-in");
      console.error("Google sign-in error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) validateEmail(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (passwordError) validatePassword(e.target.value);
  };

  if (session) {
    return (
      <div className="p-6 space-y-4 flex flex-col items-center max-w-md mx-auto">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">✓</span>
            </div>
            <h2 className="font-semibold text-xl">Welcome back!</h2>
            <p className="text-muted-foreground">
              You're signed in and ready to go.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center px-4 py-8 max-w-md mx-auto w-full">
      <div className="w-full rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-lg p-6">
        {/* Header with gradient text */}
        <div className="text-center space-y-2 animate-in fade-in slide-in-from-top-4 duration-700">
          <h1 className="font-bold text-2xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Welcome to n8nGPT
          </h1>
          {!showForgotPassword && (
            <p className="text-muted-foreground text-sm">Sign in to continue</p>
          )}
        </div>

        {/* Loading indicator */}
        {isPending && (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        )}

        {/* Auth Form */}
        {!isPending && (
          <div
            className={`mt-6 space-y-4 transition-all duration-500 ease-out ${
              showForm ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {/* Email */}
            {!showForgotPassword && (
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm text-foreground/90">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  disabled={isLoading}
                  aria-invalid={!!emailError}
                />
                {emailError && (
                  <p className="text-destructive text-xs px-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    {emailError}
                  </p>
                )}
              </div>
            )}

            {/* Password */}
            {!showForgotPassword && (
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm text-foreground/90"
                >
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={handlePasswordChange}
                    disabled={isLoading}
                    aria-invalid={!!passwordError}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") signIn();
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-2 my-auto h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-destructive text-xs px-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    {passwordError}
                  </p>
                )}

                {/* Forgot Password Link */}
                {!showForgotPassword &&
                  !awaitingOtp &&
                  !awaitingPasswordReset && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs text-primary hover:underline"
                        disabled={isLoading}
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
              </div>
            )}

            {/* OTP verification block (shown after sign-up) */}
            {awaitingOtp && (
              <div className="space-y-2">
                <label htmlFor="otp" className="text-sm text-foreground/90">
                  Verification code
                </label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  placeholder="Enter the 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") verifyEmailWithOtp();
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-9 text-xs"
                    disabled={isLoading}
                    onClick={async () => {
                      try {
                        await authClient.emailOtp.sendVerificationOtp({
                          email,
                          type: "email-verification",
                        });
                        setMessage("Code resent");
                      } catch {
                        setMessage("Could not resend code");
                      }
                    }}
                  >
                    Resend code
                  </Button>
                </div>
              </div>
            )}

            {/* Forgot Password Form */}
            {showForgotPassword && !awaitingPasswordReset && (
              <div className="space-y-4 border-t border-border/50 pt-4">
                <div className="text-center">
                  <h3 className="font-medium text-sm">Reset your password</h3>
                  <p className="text-xs text-muted-foreground">
                    Enter your email to receive a reset code
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="forgot-email"
                    className="text-sm text-foreground/90"
                  >
                    Email
                  </label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="you@example.com"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-9 text-xs flex-1"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotPasswordEmail("");
                      setMessage("");
                    }}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="h-9 text-xs flex-1"
                    onClick={sendPasswordResetOtp}
                    disabled={isLoading || !forgotPasswordEmail}
                  >
                    {isLoading ? "Sending..." : "Send Code"}
                  </Button>
                </div>
              </div>
            )}

            {/* Password Reset with OTP */}
            {awaitingPasswordReset && (
              <div className="space-y-4 border-t border-border/50 pt-4">
                <div className="text-center">
                  <h3 className="font-medium text-sm">
                    Enter reset code & new password
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Check your email for the verification code
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="reset-otp"
                    className="text-sm text-foreground/90"
                  >
                    Verification code
                  </label>
                  <Input
                    id="reset-otp"
                    inputMode="numeric"
                    placeholder="Enter the 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="new-password"
                    className="text-sm text-foreground/90"
                  >
                    New password
                  </label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (newPasswordError) validateNewPassword(e.target.value);
                    }}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="confirm-password"
                    className="text-sm text-foreground/90"
                  >
                    Confirm new password
                  </label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (newPasswordError && newPassword)
                        validateNewPassword(newPassword);
                    }}
                    disabled={isLoading}
                  />
                  {newPasswordError && (
                    <p className="text-destructive text-xs px-1 animate-in fade-in slide-in-from-top-1 duration-200">
                      {newPasswordError}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-9 text-xs"
                    disabled={isLoading}
                    onClick={async () => {
                      try {
                        await authClient.forgetPassword.emailOtp({
                          email: forgotPasswordEmail || email,
                        });
                        setMessage("Code resent");
                      } catch {
                        setMessage("Could not resend code");
                      }
                    }}
                  >
                    Resend code
                  </Button>
                  <Button
                    className="h-9 text-xs flex-1"
                    onClick={resetPassword}
                    disabled={
                      isLoading || !otp || !newPassword || !confirmPassword
                    }
                  >
                    {isLoading ? "Resetting..." : "Reset Password"}
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  className="h-8 text-xs w-full"
                  onClick={() => {
                    setAwaitingPasswordReset(false);
                    setShowForgotPassword(false);
                    setOtp("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setForgotPasswordEmail("");
                    setMessage("");
                  }}
                  disabled={isLoading}
                >
                  Back to sign in
                </Button>
              </div>
            )}

            {/* Primary actions */}
            {!showForgotPassword && <div className="pt-1 grid grid-cols-1 gap-2">
              {!awaitingOtp && !showForgotPassword && !awaitingPasswordReset ? (
                <>
                  <Button
                    className="h-10 text-sm"
                    onClick={signIn}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                        Signing in...
                      </span>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 text-sm"
                    onClick={signUp}
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </>
              ) : (
                <Button
                  className="h-10 text-sm"
                  onClick={verifyEmailWithOtp}
                  disabled={isLoading}
                >
                  Verify email
                </Button>
              )}
            </div>}

            {/* Divider */}
            <div className="relative text-center py-1">
              <span className="relative z-10 bg-card/60 px-2 text-xs text-muted-foreground">
                or
              </span>
              <div className="absolute left-0 right-0 top-1/2 -z-0 h-px bg-border" />
            </div>

            {/* Google */}
            <Button
              variant="outline"
              className="h-10 w-full text-sm flex items-center justify-center gap-2"
              onClick={signInWithGoogle}
              disabled={isLoading}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="h-4 w-4"
              >
                <path
                  fill="#FFC107"
                  d="M43.6 20.5H42V20H24v8h11.3A12 12 0 1124 12a11.9 11.9 0 018.4 3.3l5.7-5.7A20 20 0 1024 44c10.5 0 19-8.5 19-19 0-1.6-.2-2.8-.4-4.5z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.3 14.7l6.6 4.8A12 12 0 0124 12c3.3 0 6.3 1.3 8.4 3.3l5.7-5.7A20 20 0 006.3 14.7z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.4 0 10.3-2.1 13.9-5.6l-6.4-5.2A12 12 0 0112.8 29l-6.5 5C9.6 39.6 16.3 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.6 20.5H42V20H24v8h11.3c-1 3-3.1 5.4-5.8 6.8l6.4 5.2C39.9 37.9 44 31.6 44 25c0-1.6-.2-3.1-.4-4.5z"
                />
              </svg>
              Continue with Google
            </Button>

            {/* Message */}
            {message && (
              <div
                className={`mt-2 text-center text-sm p-3 rounded-lg animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                  message.includes("failed") || message.includes("error")
                    ? "bg-destructive/10 text-destructive border border-destructive/20"
                    : "bg-primary/10 text-primary border border-primary/20"
                }`}
              >
                {message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
