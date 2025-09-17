import { isN8nPageByDOM } from "@/lib/n8n-detector";

export default defineContentScript({
  // Match all HTTPS and HTTP pages for dynamic n8n detection
  matches: ["https://*/*", "http://*/*"],
  runAt: "document_end",
  main() {
    console.log("Hi from n8ngpt");
    // Only run on pages that appear to be n8n instances
    if (isN8nPageByDOM()) {
      console.log("N8N page detected, content script active");

      // Add visual indicator that the extension is active on this page
      const indicator = document.createElement("div");
      indicator.id = "n8n-gpt-indicator";
      indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #4CAF50;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui;
        z-index: 10000;
        opacity: 0.8;
        pointer-events: none;
        transition: opacity 0.3s ease;
      `;
      indicator.textContent = "n8n GPT Ready";
      document.body.appendChild(indicator);

      // Auto-hide the indicator after 3 seconds
      setTimeout(() => {
        indicator.style.opacity = "0";
        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
        }, 300);
      }, 3000);

      // Clipboard-based capture removed: using direct Pinia access elsewhere

      // Listen for messages from the extension
      browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "PING_N8N_PAGE") {
          sendResponse({ isN8nPage: true });
          return;
        }
        // Clipboard-based capture removed
      });
    }
  },
});
