import React from "react";

interface StatusIndicatorsProps {
  isOnN8n: boolean;
  generationError: string | null;
  backendError: string | null;
  onClearGenerationError: () => void;
  onClearBackendError: () => void;
}

export const StatusIndicators: React.FC<StatusIndicatorsProps> = ({
  isOnN8n,
  generationError,
  backendError,
  onClearGenerationError,
  onClearBackendError,
}) => {
  return (
    <>
      {!isOnN8n && (
        <div className="mx-4 mb-2 rounded-xl bg-gradient-to-r from-muted/40 to-muted/20 border border-border/30 p-4 text-sm text-muted-foreground animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-yellow-500/60 rounded-full animate-pulse"></div>
            <span className="font-medium">n8n Required</span>
          </div>
          <p className="text-xs leading-relaxed">
            This extension works only on n8n pages. Navigate to an n8n
            workflow tab to start creating automations.
          </p>
        </div>
      )}

      {generationError && (
        <div className="mx-4 mb-2 rounded-xl bg-gradient-to-r from-destructive/20 to-destructive/10 border border-destructive/30 p-4 text-sm animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-destructive rounded-full"></div>
            <span className="font-medium text-destructive">
              Generation Limit Reached
            </span>
          </div>
          <p className="text-xs leading-relaxed text-destructive/90 mb-3">
            {generationError}
          </p>
          <button
            onClick={onClearGenerationError}
            className="text-xs px-3 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 transition-colors duration-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {backendError && (
        <div className="mx-4 mb-2 rounded-xl bg-gradient-to-r from-destructive/20 to-destructive/10 border border-destructive/30 p-4 text-sm animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-destructive rounded-full"></div>
            <span className="font-medium text-destructive">
              Something went wrong
            </span>
          </div>
          <p className="text-xs leading-relaxed text-destructive/90 mb-3">
            {backendError}
          </p>
          <button
            onClick={onClearBackendError}
            className="text-xs px-3 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 transition-colors duration-200"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
};