import { useState, useEffect } from "react";
import { browser } from "wxt/browser";
import { isN8nInstance } from "@/lib/n8n-detector";

export const useN8nDetection = () => {
  const [isOnN8n, setIsOnN8n] = useState<boolean>(false);

  useEffect(() => {
    const updateN8nStatus = async () => {
      try {
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        const url = typeof tab?.url === "string" ? tab.url : "";
        setIsOnN8n(isN8nInstance(url));
      } catch {
        setIsOnN8n(false);
      }
    };

    // Initial check
    updateN8nStatus();

    // Listen for tab changes
    const onUpdated = (_tabId: number, changeInfo: any) => {
      if (changeInfo?.url) updateN8nStatus();
    };

    const onActivated = () => updateN8nStatus();

    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onActivated.addListener(onActivated as any);

    return () => {
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onActivated.removeListener(onActivated as any);
    };
  }, []);

  return { isOnN8n };
};