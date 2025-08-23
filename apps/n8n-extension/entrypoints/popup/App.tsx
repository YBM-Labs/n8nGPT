import { Button } from "@/components/ui/button";
import { browser } from "wxt/browser";

export default function App() {
  /**
   * Opens the side panel directly from the popup (user gesture context)
   */
  const openSidePanel = async () => {
    try {
      // Get the current active tab
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tabs[0]?.id) {
        // Open side panel directly from popup (maintains user gesture context)
        await browser.sidePanel.open({ tabId: tabs[0].id });
        console.log("Side panel opened successfully");

        // Close the popup after opening side panel
        window.close();
      } else {
        console.error("No active tab found");
      }
    } catch (error) {
      console.error("Error opening side panel:", error);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold mb-4">n8n Extension</h1>
      <Button onClick={openSidePanel}>Open Sidebar</Button>
    </div>
  );
}
