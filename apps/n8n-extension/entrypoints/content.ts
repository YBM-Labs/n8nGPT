import { isN8nPageByDOM, getN8nCanvasSelectors } from "@/lib/n8n-detector";

export default defineContentScript({
  // Match all HTTPS and HTTP pages for dynamic n8n detection
  matches: ["https://*/*", "http://*/*"],
  runAt: "document_end",
  main() {
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

      // Floating action button to send workflow to sidepanel
      const existing = document.getElementById("n8n-gpt-send-btn");
      if (!existing) {
        const btn = document.createElement("button");
        btn.id = "n8n-gpt-send-btn";
        btn.type = "button";
        btn.textContent = "n8nGPT";
        btn.setAttribute("aria-label", "Send workflow JSON to n8nGPT");
        btn.style.cssText = `
          position: fixed;
          right: 12px;
          bottom: 12px;
          z-index: 2147483647;
          background: #111827;
          color: #ffffff;
          border: 1px solid rgba(255,255,255,0.2);
          padding: 8px 12px;
          border-radius: 10px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui;
          font-size: 12px;
          cursor: pointer;
        `;

        const getCanvas = (): HTMLElement | null => {
          const selectors = getN8nCanvasSelectors();
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el instanceof HTMLElement) return el;
          }
          return null;
        };

        const focusForShortcuts = (element: HTMLElement): void => {
          try {
            window.focus();
            document.body?.focus?.();
            element.focus();
            element.dispatchEvent(
              new MouseEvent("mousedown", { bubbles: true, cancelable: true })
            );
            element.dispatchEvent(
              new MouseEvent("mouseup", { bubbles: true, cancelable: true })
            );
            element.dispatchEvent(
              new MouseEvent("click", { bubbles: true, cancelable: true })
            );
          } catch {}
        };

        const dispatchShortcut = (
          target: EventTarget,
          key: string,
          code: string
        ): void => {
          const down = new KeyboardEvent("keydown", {
            key,
            code,
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          });
          const up = new KeyboardEvent("keyup", {
            key,
            code,
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          });
          (target as HTMLElement).dispatchEvent(down);
          (target as HTMLElement).dispatchEvent(up);
        };

        const getFromClipboardData = (cd: DataTransfer | null): string => {
          if (!cd) return "";
          const preferredTypes = ["application/json", "text/plain", "text"];
          for (const t of preferredTypes) {
            try {
              const v = cd.getData(t);
              if (typeof v === "string" && v.length > 0) return v;
            } catch {}
          }
          try {
            const types = Array.from(cd.types ?? []);
            for (const t of types) {
              const v = cd.getData(t);
              if (typeof v === "string" && v.length > 0) return v;
            }
          } catch {}
          return "";
        };

        btn.addEventListener("click", async () => {
          try {
            const canvas = getCanvas();
            if (!canvas) {
              console.warn("[n8n-gpt] No canvas element found");
              return;
            }

            let captured = "";
            const onCopy = (e: ClipboardEvent): void => {
              try {
                const data = getFromClipboardData(e.clipboardData ?? null);
                if (data.length > 0) {
                  captured = data;
                }
              } catch {}
            };

            focusForShortcuts(canvas);
            document.addEventListener("copy", onCopy, {
              capture: true,
              once: true,
            } as AddEventListenerOptions);
            // Select all nodes, then copy
            dispatchShortcut(canvas, "a", "KeyA");
            dispatchShortcut(canvas, "c", "KeyC");
            try {
              document.execCommand("copy");
            } catch {}
            await new Promise((r) => setTimeout(r, 180));

            // Fallback to reading from clipboard (still inside user gesture)
            if (captured.length === 0) {
              try {
                const text = await navigator.clipboard.readText();
                if (typeof text === "string" && text.length > 0) {
                  captured = text;
                }
              } catch {}
            }

            if (captured.length > 0) {
              try {
                await browser.runtime.sendMessage({
                  type: "WORKFLOW_JSON",
                  json: captured,
                });
              } catch {}
            } else {
              console.warn(
                "[n8n-gpt] No workflow JSON captured from copy event or clipboard"
              );
            }
          } catch (err) {
            console.error("[n8n-gpt] Failed to send workflow:", err);
          }
        });

        document.body.appendChild(btn);
      }

      // Listen for messages from the extension
      browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "PING_N8N_PAGE") {
          sendResponse({ isN8nPage: true });
        }
      });
    }
  },
});
