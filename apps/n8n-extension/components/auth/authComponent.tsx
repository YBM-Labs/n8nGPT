import { authClient } from "@/lib/auth-client";
import { useState, useEffect } from "react";

export default function AuthPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
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

      setMessage(
        error ? `Sign up failed: ${error.message}` : "Sign up successful! 🎉"
      );
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
    <div className="p-6 space-y-6 flex flex-col items-center max-w-md mx-auto min-h-[400px]">
      {/* Header with gradient text */}
      <div className="text-center space-y-2 animate-in fade-in slide-in-from-top-4 duration-700">
        <h1 className="font-bold text-3xl bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
          Welcome to n8n GPT
        </h1>
        <p className="text-muted-foreground text-sm">
          Sign in to access your workflow automation
        </p>
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
          className={`w-full space-y-4 transition-all duration-500 ease-out ${
            showForm ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {/* Email Input */}
          <div className="space-y-1">
            <input
              className={`w-full rounded-xl border px-4 py-3 text-base bg-background/50 backdrop-blur-sm
                transition-all duration-200 ease-in-out
                focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
                hover:border-primary/50 hover:bg-background/80
                ${emailError ? "border-destructive focus:ring-destructive/50" : "border-border"}
              `}
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={handleEmailChange}
              disabled={isLoading}
            />
            {emailError && (
              <p className="text-destructive text-xs px-1 animate-in fade-in slide-in-from-top-1 duration-200">
                {emailError}
              </p>
            )}
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <input
              className={`w-full rounded-xl border px-4 py-3 text-base bg-background/50 backdrop-blur-sm
                transition-all duration-200 ease-in-out
                focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
                hover:border-primary/50 hover:bg-background/80
                ${passwordError ? "border-destructive focus:ring-destructive/50" : "border-border"}
              `}
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={handlePasswordChange}
              disabled={isLoading}
            />
            {passwordError && (
              <p className="text-destructive text-xs px-1 animate-in fade-in slide-in-from-top-1 duration-200">
                {passwordError}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col w-full gap-3 pt-2">
            <button
              className={`relative font-medium rounded-xl px-4 py-3 w-full transition-all duration-200 ease-in-out
                overflow-hidden group
                ${
                  isLoading
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                }
              `}
              onClick={signIn}
              disabled={isLoading}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin"></div>
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            </button>

            <button
              className={`font-medium rounded-xl border px-4 py-3 w-full transition-all duration-200 ease-in-out
                ${
                  isLoading
                    ? "border-muted text-muted-foreground cursor-not-allowed"
                    : "border-border text-foreground hover:border-primary hover:bg-primary/5 hover:scale-[1.02] active:scale-[0.98]"
                }
              `}
              onClick={signUp}
              disabled={isLoading}
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </button>
          </div>

          {/* Message Display */}
          {message && (
            <div
              className={`text-center text-sm p-3 rounded-lg animate-in fade-in slide-in-from-bottom-2 duration-300 ${
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
  );
}
