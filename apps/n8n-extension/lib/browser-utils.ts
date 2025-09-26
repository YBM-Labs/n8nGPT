import { browser } from "wxt/browser";
import {
  isN8nInstance,
  createN8nHostPermissions
} from "@/lib/n8n-detector";
import { ERROR_MESSAGES } from "./constants";

export interface ActiveTab {
  tabId: number;
  tabUrl: string;
}

export class BrowserApiError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'BrowserApiError';
  }
}

/**
 * Gets the active tab info and validates it's an n8n instance
 */
export const getActiveN8nTab = async (): Promise<ActiveTab> => {
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    const tabId = typeof tab?.id === "number" ? tab.id : null;
    const tabUrl = typeof tab?.url === "string" ? tab.url : "";

    if (tabId === null || tabUrl.length === 0) {
      throw new BrowserApiError(ERROR_MESSAGES.NO_ACTIVE_TAB);
    }

    if (!isN8nInstance(tabUrl)) {
      throw new BrowserApiError(ERROR_MESSAGES.NOT_N8N_INSTANCE);
    }

    return { tabId, tabUrl };
  } catch (error) {
    if (error instanceof BrowserApiError) throw error;
    throw new BrowserApiError(ERROR_MESSAGES.NO_ACTIVE_TAB, error);
  }
};

/**
 * Requests permissions for the given n8n hostname
 */
export const requestN8nPermissions = async (hostname: string): Promise<void> => {
  try {
    const hostPermissions = createN8nHostPermissions(hostname);
    const hasPermission = await browser.permissions.contains({
      origins: hostPermissions,
    });

    if (!hasPermission) {
      try {
        await browser.permissions.request({ origins: hostPermissions });
      } catch (error) {
        // Permission request failed, but continue (non-blocking)
        console.warn("Permission request failed:", error);
      }
    }
  } catch (error) {
    // Permission check failed, but continue (non-blocking)
    console.warn("Permission check failed:", error);
  }
};

/**
 * Executes a script in the active n8n tab with permission handling
 */
export const executeN8nScript = async <T>(
  scriptFunc: () => T,
  args?: unknown[]
): Promise<T> => {
  const { tabId, tabUrl } = await getActiveN8nTab();
  const url = new URL(tabUrl);

  await requestN8nPermissions(url.hostname);

  const result = await browser.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: scriptFunc,
    args: args || [],
  });

  const scriptResult = result?.[0]?.result;
  return scriptResult as T;
};

/**
 * Extract JSON from text with various formats
 */
export const extractJsonFromText = (text: string): string | null => {
  // Try fenced JSON first
  const fencedJson = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedJson && fencedJson[1]?.trim()) {
    return fencedJson[1].trim();
  }

  // Try any fenced code that might be JSON
  const fenced = text.match(/```\s*([\s\S]*?)```/);
  if (fenced && fenced[1]?.trim()) {
    const candidate = fenced[1].trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Not valid JSON, continue
    }
  }

  // Try to find JSON object boundaries
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const candidate = text.slice(first, last + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Not valid JSON
    }
  }

  return null;
};