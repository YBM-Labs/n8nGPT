import { isN8nInstance } from "@/lib/n8n-detector";

interface RuntimeMessage {
  type: string;
  tabId?: number;
  workflowData?: any;
  metadata?: any;
}

interface RuntimeSender {
  tab?: any;
  frameId?: number;
  id?: string;
  url?: string;
  origin?: string;
}

type SendResponse = (response?: any) => void;

export default defineBackground({
  main() {
    console.log("N8N GPT Background Script", {
      id: browser.runtime.id,
    });

    // Prefer native behavior: open side panel on action click (Chrome 116+)
    try {
      const chromeApi: any = (globalThis as any).chrome;
      const sp: any = chromeApi?.sidePanel;
      if (sp?.setPanelBehavior) {
        sp.setPanelBehavior({ openPanelOnActionClick: true });
      }
    } catch (error) {
      console.log("sidePanel.setPanelBehavior not available:", error);
    }

    // Fallback for browsers/versions without setPanelBehavior
    try {
      const chromeApi: any = (globalThis as any).chrome;
      chromeApi?.action?.onClicked?.addListener?.(async (tab: any) => {
        try {
          const sp: any = chromeApi?.sidePanel;
          if (!sp) return;

          // Ensure the panel is enabled for this tab when needed
          if (sp.setOptions && tab?.id) {
            await sp.setOptions({ tabId: tab.id, enabled: true });
          }

          // Open the panel for the current window
          if (sp.open) {
            await sp.open({ windowId: tab?.windowId });
          }
        } catch (err) {
          console.log("Failed to open side panel on action click:", err);
        }
      });
    } catch (error) {
      console.log("chrome.action listener not available:", error);
    }

    // Handle OAuth popup callbacks
    browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      // Check if this is a popup window and the URL contains our extension ID
      if (changeInfo.status === "complete" && tab.url) {
        const extensionId = browser.runtime.id;
        const expectedCallbackUrl = `chrome-extension://${extensionId}`;

        // Check if this is an OAuth callback to our extension
        if (tab.url.startsWith(expectedCallbackUrl)) {
          console.log("OAuth callback detected:", tab.url);

          // Close the popup window
          if (tab.windowId) {
            try {
              await browser.windows.remove(tab.windowId);
            } catch (error) {
              console.log("Could not close popup window:", error);
            }
          }

          // Notify the sidepanel that auth is complete
          try {
            await browser.runtime.sendMessage({
              type: "OAUTH_CALLBACK",
              url: tab.url,
            });
          } catch (error) {
            console.log("Could not send OAuth callback message:", error);
          }
        }
      }
    });

    /**
     * Handle messages from sidepanel and content scripts
     */
    browser.runtime.onMessage.addListener(
      async (
        message: RuntimeMessage,
        sender: RuntimeSender,
        sendResponse: SendResponse
      ) => {
        switch (message.type) {
          case "CHECK_N8N_TAB": {
            // Check if current active tab is an n8n instance
            try {
              const [tab] = await browser.tabs.query({
                active: true,
                currentWindow: true,
              });

              if (tab?.url) {
                const isN8n = isN8nInstance(tab.url);
                sendResponse({ isN8nInstance: isN8n, url: tab.url });
              } else {
                sendResponse({ isN8nInstance: false, error: "No active tab" });
              }
            } catch (error) {
              sendResponse({
                isN8nInstance: false,
                error: "Failed to check tab",
              });
            }
            break;
          }

          case "PING": {
            // Simple ping response
            sendResponse({ pong: true });
            break;
          }

          default:
            sendResponse({ error: "Unknown message type" });
        }

        // Return true to indicate we'll send a response asynchronously
        return true;
      }
    );
  },
});
