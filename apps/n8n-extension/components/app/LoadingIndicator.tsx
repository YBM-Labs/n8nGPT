import React from "react";
import { Loader } from "@/components/ai-elements/loader";
import ShinyText from "@/components/ShinyText";

interface LoadingIndicatorProps {
  status: string;
  isToolCalling: boolean;
  generationError: string | null;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  status,
  isToolCalling,
  generationError,
}) => {
  if ((status === "submitted" || status !== "ready") && !generationError) {
    return (
      <div className="mt-2 mb-4 animate-in fade-in duration-300">
        <div className="flex items-center gap-3 w-fit px-4 py-2 rounded-xl bg-muted/20 border border-border/30">
          <Loader />
          <span className="text-sm font-medium text-muted-foreground">
            {isToolCalling ? "Implementing the changes" : "Thinking..."}
          </span>
        </div>
      </div>
    );
  }

  return null;
};

interface BrainstormingIndicatorProps {
  show: boolean;
}

export const BrainstormingIndicator: React.FC<BrainstormingIndicatorProps> = ({
  show,
}) => {
  if (!show) return null;

  return (
    <div className="mt-2 mb-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 w-fit px-4 py-2 rounded-xl bg-muted/20 border border-border/30">
        <Loader />
        <span className="text-sm font-medium text-muted-foreground">
          <ShinyText text="Brainstorming.." speed={3} />
        </span>
      </div>
    </div>
  );
};