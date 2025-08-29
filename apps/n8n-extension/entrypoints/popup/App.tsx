import { Button } from "@/components/ui/button";
import { browser } from "wxt/browser";
import { useState, useEffect } from "react";

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [showContent, setShowContent] = useState(false);

  // Animate entrance
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const openSidePanel = async () => {
    setIsLoading(true);
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tabs[0]?.id) {
        await browser.sidePanel.open({ tabId: tabs[0].id });
        window.close();
      } else {
        console.error("No active tab found");
      }
    } catch (error) {
      console.error("Error opening side panel:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 min-w-[280px] bg-gradient-to-br from-background to-background/95">
      {/* Header with gradient text */}
      <div
        className={`text-center space-y-2 transition-all duration-500 ease-out ${
          showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center mx-auto mb-3">
          <span className="text-xl font-bold text-primary-foreground">n8n</span>
        </div>
        <h1 className="font-bold text-xl bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
          n8n GPT Extension
        </h1>
        <p className="text-muted-foreground text-sm">
          AI-powered workflow automation assistant
        </p>
      </div>

      {/* Main Action */}
      <div
        className={`space-y-4 transition-all duration-700 delay-200 ease-out ${
          showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <Button
          onClick={openSidePanel}
          disabled={isLoading}
          className={`w-full py-3 font-medium transition-all duration-200 ease-in-out
            hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
            bg-primary text-primary-foreground hover:bg-primary/90
            ${isLoading ? "cursor-not-allowed opacity-60" : ""}
          `}
        >
          <span className="flex items-center justify-center gap-2">
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin"></div>
                Opening...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                Open Sidebar
              </>
            )}
          </span>
        </Button>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            💡 Works best in the sidebar panel
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-pulse"></div>
            <span>Navigate to an n8n workflow to start</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className={`border-t pt-4 transition-all duration-700 delay-300 ease-out ${
          showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <span>Powered by</span>
          <a href="https://ybmlabs.com/" className="font-medium text-primary">
            YBM Labs
          </a>
        </div>
      </div>
    </div>
  );
}
