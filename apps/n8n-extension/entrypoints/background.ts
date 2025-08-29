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
