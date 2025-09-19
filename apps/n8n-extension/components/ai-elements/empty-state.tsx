import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bug, Info, Sparkles, Webhook, Workflow } from "lucide-react";
import logo from "@/assets/icon.png";

export type EmptyStateProps = {
  className?: string;
  onPrompt?: (text: string) => void;
  suggestions?: ReadonlyArray<string>;
};

/**
 * EmptyState renders the initial UI shown when there are no chat messages yet.
 * The design is tuned for a narrow Chrome side panel and focuses on:
 *  - Clear visual hierarchy
 *  - Subtle depth through gradients and shadows
 *  - Excellent accessibility (semantics, roles, and labels)
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  className,
  onPrompt,
  suggestions = [
    "Explain what this workflow does",
    "Find errors in my workflow",
    "Add a webhook trigger",
  ],
}) => {
  /**
   * Return an icon for a given suggestion string. Falls back to Sparkles.
   */
  const getIconForSuggestion = (text: string): React.ReactElement => {
    const lower = text.toLowerCase();
    if (lower.includes("error") || lower.includes("bug")) {
      return <Bug className="h-3.5 w-3.5" aria-hidden />;
    }
    if (lower.includes("webhook") || lower.includes("trigger")) {
      return <Webhook className="h-3.5 w-3.5" aria-hidden />;
    }
    if (lower.includes("explain") || lower.includes("what")) {
      return <Info className="h-3.5 w-3.5" aria-hidden />;
    }
    return <Sparkles className="h-3.5 w-3.5" aria-hidden />;
  };

  return (
    <section
      className={cn(
        "relative flex h-full w-full items-center justify-center px-4",
        "overflow-hidden",
        className
      )}
      role="region"
      aria-label="Empty conversation state"
    >
      <div
        className={cn(
          "absolute inset-0",
          "[background-size:25px_25px]",

          "[background-image:linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)]"
        )}
      />
      {/* Radial fade overlay: subtle edge fade without wave artifacts */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_28%,hsl(var(--background)/0.55)_100%)]"
      />
      <div className="relative z-10 flex max-w-[440px] flex-col items-center text-center">
        {/* App glyph */}
        <div
          className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-gradient-to-b from-background to-muted/40 shadow-sm ring-1 ring-black/5 dark:ring-white/5"
          aria-hidden
        >
          {/* <Workflow className="h-6 w-6 text-primary" />
           */}
          <img
            src={logo}
            className="text-xs font-bold text-primary-foreground object-contain p-3"
          />
        </div>

        <h2 className="mb-1 text-balance text-xl font-semibold tracking-tight">
          Welcome to n8nGPT
        </h2>
        <p className="mb-5 text-pretty text-sm text-muted-foreground">
          Think of me as your Cursor-like copilot for n8n. Ask for changes,
          reviews, or fixes—then watch your canvas evolve.
        </p>

        {/* Suggestion pills */}
        <ul
          className="mb-2 grid w-full grid-cols-1 gap-2 sm:grid-cols-2"
          aria-label="Starter suggestions"
        >
          {suggestions.map((s) => (
            <li key={s} className="flex">
              <Button
                type="button"
                variant="outline"
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border-border/50 bg-card/60 px-3 text-xs font-medium shadow-sm backdrop-blur-sm transition-colors hover:bg-card/80"
                onClick={() => {
                  if (typeof onPrompt === "function") {
                    onPrompt(s);
                  }
                }}
                aria-label={s}
              >
                {getIconForSuggestion(s)}
                <span className="truncate">{s}</span>
              </Button>
            </li>
          ))}
        </ul>

        <div className="text-[11px] text-muted-foreground">
          Or type your own request below
        </div>
      </div>
    </section>
  );
};

export default EmptyState;
