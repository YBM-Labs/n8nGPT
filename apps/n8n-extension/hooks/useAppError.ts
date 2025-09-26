import { useState, useCallback } from "react";
import type { AppError } from "@/lib/types";

export const useAppError = () => {
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  const handleError = useCallback((error: Error) => {
    console.error("Chat error:", error.message);

    if (error.message) {
      try {
        const errorText = error.message;
        if (errorText.includes("maximum number of generations")) {
          setGenerationError(
            "You have reached the maximum number of generations for this month. Please wait until the first day of the next month to continue."
          );
        } else {
          setBackendError(
            "You have reached your monthly limit. Please try again next month."
          );
        }
      } catch {
        setBackendError(
          "Backend error occurred while processing your request. Please try again."
        );
      }
    } else {
      setBackendError(
        "An error occurred while processing your request. Please try again."
      );
    }
  }, []);

  const clearGenerationError = useCallback(() => {
    setGenerationError(null);
  }, []);

  const clearBackendError = useCallback(() => {
    setBackendError(null);
  }, []);

  const clearAllErrors = useCallback(() => {
    setGenerationError(null);
    setBackendError(null);
  }, []);

  return {
    generationError,
    backendError,
    handleError,
    clearGenerationError,
    clearBackendError,
    clearAllErrors,
  };
};