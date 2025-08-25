"use client";

import { useState } from "react";
import { browser } from "wxt/browser";
import { useChat } from "@ai-sdk/react";
// import { GlobeIcon } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Badge } from "@/components/ui/badge";
import {
  PromptInput,
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Response } from "@/components/ai-elements/response";
import { Loader } from "@/components/ai-elements/loader";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/source";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";

// ----- Message part type guards to avoid unsafe casts -----
type SourceUrlPart = { type: "source-url"; url: string };
type TextPart = { type: "text"; text: string };
type ReasoningPart = { type: "reasoning"; text: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSourceUrlPart = (part: unknown): part is SourceUrlPart =>
  isRecord(part) && part.type === "source-url" && typeof part.url === "string";

const isTextPart = (part: unknown): part is TextPart =>
  isRecord(part) && part.type === "text" && typeof part.text === "string";

const isReasoningPart = (part: unknown): part is ReasoningPart =>
  isRecord(part) && part.type === "reasoning" && typeof part.text === "string";

/**
 * App
 * Renders a themed AI chat interface for the sidepanel using shared components from `@/components`.
 * - Uses Tailwind theme tokens (e.g. bg-background, text-foreground) with no static colors.
 * - Preserves the existing n8n "Paste Workflow" utility as a toolbar action.
 */
export default function App() {
  /**
   * Available model options for the chat UI.
   */
  const MODELS: ReadonlyArray<{ name: string; value: string }> = [
    {
      name: "Claude Sonnet 4",
      value: "anthropic/claude-sonnet-4",
    },
    { name: "Gemini 2.0 Flash", value: "google/gemini-2.0-flash-001" },
    { name: "Deepseek R1", value: "deepseek/deepseek-r1" },
  ];

  // Local chat UI state
  const [input, setInput] = useState<string>("");
  const [model, setModel] = useState<string>(
    MODELS[0]?.value ?? "openai/gpt-4o"
  );
  const [webSearch, setWebSearch] = useState<boolean>(false);

  // AI chat hook (expects a backend handler; UI will still render without one)
  const { messages, sendMessage, status, addToolResult } = useChat({
    transport: new DefaultChatTransport({
      api: import.meta.env.VITE_BACKEND_API ?? "http://localhost:5000",
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName === "paste_json_in_n8n") {
        await pasteContent({
          content: (toolCall.input as { json: string }).json,
        });

        addToolResult({
          tool: "getLocation",
          toolCallId: toolCall.toolCallId,
          output: `Workflow is created in n8n`,
        });
      }
    },
  });

  /**
   * Handle prompt submission. Prevent default form post and dispatch to useChat.
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return;
    }
    sendMessage(
      { text: trimmed },
      {
        body: {
          model,
          webSearch,
        },
      }
    );
    setInput("");
  };

  /**
   * Demo workflow payload for n8n paste helper.
   */

  /**
   * Paste the demo workflow JSON into an active n8n tab (same behavior as before),
   * kept here as a utility action available from the chat's toolbar.
   */
  const pasteContent = async ({
    content,
  }: {
    content: string;
  }): Promise<void> => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      const tabId = typeof tab?.id === "number" ? tab.id : null;
      const tabUrl = typeof tab?.url === "string" ? tab.url : "";
      if (tabId === null || tabUrl.length === 0) {
        return;
      }

      const url = new URL(tabUrl);
      const isTargetHost = url.host === "magic.yourbrandmate.agency";
      if (!isTargetHost) {
        return;
      }

      try {
        const granted = await (
          browser as typeof browser & {
            permissions?: {
              request?: (p: { origins: string[] }) => Promise<boolean>;
            };
          }
        ).permissions?.request?.({
          origins: ["https://magic.yourbrandmate.agency/*"],
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _ = granted;
      } catch {
        // Ignore permission request failures
      }

      await browser.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: async (content) => {
          const tryApiImport = async (): Promise<boolean> => {
            // DISABLED: API imports cause logout issues
            // Instead, we'll rely on clipboard paste method only
            console.log(
              "API import disabled to prevent logout issues - using clipboard method"
            );
            return false;
          };

          const apiImported = await tryApiImport();
          if (apiImported) {
            return;
          }

          const selectors = [
            ".vue-flow__pane.vue-flow__container.selection",
            ".vue-flow__renderer",
            '[data-test-id="canvas"]',
            ".editor",
            ".canvas",
            ".vue-flow",
          ];
          let targetEl: Element | null = null;
          for (const s of selectors) {
            const found = document.querySelector(s);
            if (found) {
              targetEl = found;
              break;
            }
          }
          if (targetEl === null) {
            targetEl = document.activeElement ?? document.body;
          }

          if (targetEl) {
            window.focus();
            (targetEl as HTMLElement).focus();
            try {
              await navigator.clipboard.writeText(content);
            } catch {
              // ignore
            }
            const createPasteEvent = () =>
              new ClipboardEvent("paste", {
                bubbles: true,
                cancelable: true,
                clipboardData: (() => {
                  const dt = new DataTransfer();
                  dt.setData("text/plain", content);
                  return dt;
                })(),
              });
            document.dispatchEvent(createPasteEvent());
          }
        },
        args: [content],
      });
    } catch {
      // Silently ignore paste failures; action is a convenience tool.
    }
  };

  /**
   * Get workflow data from the active n8n tab.
   * Retrieves the current workflow configuration and returns it as JSON.
   *
   * NOTE: This function ONLY uses n8n's internal state, DOM parsing, and UI extraction
   * to avoid authentication/logout issues that occur with REST API calls.
   * NO API calls are made to prevent session interference.
   */
  const getWorkflow = async (): Promise<string | null> => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      const tabId = typeof tab?.id === "number" ? tab.id : null;
      const tabUrl = typeof tab?.url === "string" ? tab.url : "";
      if (tabId === null || tabUrl.length === 0) {
        return null;
      }

      const url = new URL(tabUrl);
      const isTargetHost = url.host === "magic.yourbrandmate.agency";
      if (!isTargetHost) {
        return null;
      }

      try {
        const granted = await (
          browser as typeof browser & {
            permissions?: {
              request?: (p: { origins: string[] }) => Promise<boolean>;
            };
          }
        ).permissions?.request?.({
          origins: ["https://magic.yourbrandmate.agency/*"],
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _ = granted;
      } catch {
        // Ignore permission request failures
      }

      const result = await browser.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: async () => {
          try {
            // Try to get workflow from n8n's internal state first
            const tryGetFromState = (): any => {
              try {
                // Method 1: Check for n8n's Vue app instance and store
                const rootElement =
                  document.getElementById("app") ||
                  document.querySelector("[data-app]") ||
                  document.body;
                if (rootElement && (rootElement as any).__vue__) {
                  const vueInstance = (rootElement as any).__vue__;
                  if (vueInstance.$store && vueInstance.$store.getters) {
                    const workflow =
                      vueInstance.$store.getters.getCurrentWorkflow ||
                      vueInstance.$store.getters[
                        "workflows/getCurrentWorkflow"
                      ] ||
                      vueInstance.$store.state.workflows?.currentWorkflow;
                    if (workflow) {
                      return workflow;
                    }
                  }
                }

                // Method 2: Check all Vue instances for workflow data
                const allElements = document.querySelectorAll("*");
                for (const element of allElements) {
                  if (
                    (element as any).__vue__ &&
                    (element as any).__vue__.$store
                  ) {
                    const store = (element as any).__vue__.$store;
                    const workflow =
                      store.getters?.getCurrentWorkflow ||
                      store.getters?.["workflows/getCurrentWorkflow"] ||
                      store.state?.workflows?.currentWorkflow ||
                      store.state?.workflow;
                    if (workflow && workflow.nodes) {
                      return workflow;
                    }
                  }
                }

                // Method 3: Check for n8n's global state objects
                const globalChecks = [
                  (window as any).n8n?.state?.workflow,
                  (window as any).n8n?.workflowEditor?.workflow,
                  (window as any).n8nWorkflow,
                  (window as any).__N8N_WORKFLOW__,
                  (window as any).workflow,
                ];

                for (const workflow of globalChecks) {
                  if (workflow && workflow.nodes) {
                    return workflow;
                  }
                }

                // Method 4: Check Pinia stores (newer n8n versions)
                const piniaApp = (window as any).__PINIA__;
                if (piniaApp) {
                  for (const store of Object.values(piniaApp.state.value)) {
                    const storeData = store as any;
                    if (storeData.workflow && storeData.workflow.nodes) {
                      return storeData.workflow;
                    }
                    if (
                      storeData.currentWorkflow &&
                      storeData.currentWorkflow.nodes
                    ) {
                      return storeData.currentWorkflow;
                    }
                  }
                }

                // Method 5: Check for workflow in browser storage
                const storageKeys = [
                  "n8n-workflow",
                  "workflow",
                  "currentWorkflow",
                  "n8n-currentWorkflow",
                ];

                for (const key of storageKeys) {
                  const stored =
                    localStorage.getItem(key) || sessionStorage.getItem(key);
                  if (stored) {
                    try {
                      const parsed = JSON.parse(stored);
                      if (parsed.nodes) {
                        return parsed;
                      }
                    } catch {
                      // ignore parsing errors
                    }
                  }
                }

                return null;
              } catch (error) {
                console.log("Error in tryGetFromState:", error);
                return null;
              }
            };

            // Try to get workflow from DOM elements and UI state
            const tryGetFromDOM = (): any => {
              try {
                // Method 1: Look for workflow data in script tags
                const scripts = document.querySelectorAll(
                  'script[type="application/json"], script[type="application/ld+json"]'
                );
                for (const script of scripts) {
                  try {
                    const data = JSON.parse(script.textContent || "");
                    if (data.nodes && data.connections) {
                      return data;
                    }
                    // Check nested properties
                    if (data.workflow && data.workflow.nodes) {
                      return data.workflow;
                    }
                    if (data.data && data.data.nodes) {
                      return data.data;
                    }
                  } catch {
                    // ignore parsing errors
                  }
                }

                // Method 2: Look for workflow data in data attributes
                const attributeSelectors = [
                  "[data-workflow]",
                  "[data-workflow-data]",
                  "[data-n8n-workflow]",
                  "[data-current-workflow]",
                ];

                for (const selector of attributeSelectors) {
                  const elements = document.querySelectorAll(selector);
                  for (const element of elements) {
                    try {
                      const attrName = selector
                        .replace(/[\[\]]/g, "")
                        .replace("data-", "");
                      const data = JSON.parse(
                        element.getAttribute(`data-${attrName}`) || ""
                      );
                      if (data.nodes && data.connections) {
                        return data;
                      }
                    } catch {
                      // ignore parsing errors
                    }
                  }
                }

                // Method 3: Extract from n8n canvas/editor DOM
                const canvasElement = document.querySelector(
                  '.vue-flow__pane, .n8n-canvas, [data-test-id="canvas"]'
                );
                if (canvasElement) {
                  // Try to get workflow from canvas Vue instance
                  if ((canvasElement as any).__vue__) {
                    const vueInstance = (canvasElement as any).__vue__;
                    const workflow =
                      vueInstance.workflow ||
                      vueInstance.$props?.workflow ||
                      vueInstance.value;
                    if (workflow && workflow.nodes) {
                      return workflow;
                    }
                  }
                }

                // Method 4: Look for JSON data in text content of specific elements
                const jsonElements = document.querySelectorAll(
                  'pre, code, .json-data, [data-type="json"]'
                );
                for (const element of jsonElements) {
                  try {
                    const text = element.textContent || element.innerHTML;
                    if (
                      text.includes('"nodes"') &&
                      text.includes('"connections"')
                    ) {
                      const data = JSON.parse(text);
                      if (data.nodes && data.connections) {
                        return data;
                      }
                    }
                  } catch {
                    // ignore parsing errors
                  }
                }

                // Method 5: Check for workflow data in form inputs or hidden fields
                const hiddenInputs = document.querySelectorAll(
                  'input[type="hidden"], textarea[style*="display:none"]'
                );
                for (const input of hiddenInputs) {
                  try {
                    const value = (input as HTMLInputElement).value;
                    if (value && value.includes('"nodes"')) {
                      const data = JSON.parse(value);
                      if (data.nodes) {
                        return data;
                      }
                    }
                  } catch {
                    // ignore parsing errors
                  }
                }

                return null;
              } catch (error) {
                console.log("Error in tryGetFromDOM:", error);
                return null;
              }
            };

            // Create a more targeted workflow extractor for n8n UI
            const tryGetFromN8nUI = (): any => {
              try {
                // Method 1: Check for workflow export functionality
                const exportButton = document.querySelector(
                  '[data-test-id="workflow-export"], .workflow-export, [title*="export"], [aria-label*="export"]'
                );
                if (exportButton && (exportButton as any).__vue__) {
                  const vueInstance = (exportButton as any).__vue__;
                  const workflow =
                    vueInstance.workflow || vueInstance.$parent?.workflow;
                  if (workflow && workflow.nodes) {
                    return workflow;
                  }
                }

                // Method 2: Check for workflow settings or info panels
                const settingsPanel = document.querySelector(
                  '.workflow-settings, .workflow-info, [data-test-id="workflow-settings"]'
                );
                if (settingsPanel && (settingsPanel as any).__vue__) {
                  const vueInstance = (settingsPanel as any).__vue__;
                  const workflow =
                    vueInstance.workflow || vueInstance.workflowObject;
                  if (workflow && workflow.nodes) {
                    return workflow;
                  }
                }

                // Method 3: Check for node panels or sidebars that might have workflow context
                const nodePanel = document.querySelector(
                  '.node-settings, .node-panel, [data-test-id="node-panel"]'
                );
                if (nodePanel && (nodePanel as any).__vue__) {
                  const vueInstance = (nodePanel as any).__vue__;
                  // Navigate up the component tree to find workflow
                  let current = vueInstance;
                  for (let i = 0; i < 10 && current; i++) {
                    if (current.workflow && current.workflow.nodes) {
                      return current.workflow;
                    }
                    current = current.$parent;
                  }
                }

                // Method 4: Check for workflow ID in URL and try to find stored data
                const urlMatch =
                  window.location.pathname.match(/\/workflow\/([^\/]+)/);
                if (urlMatch) {
                  const workflowId = urlMatch[1];

                  // Check for workflow data stored with this ID
                  const storageKeys = [
                    `n8n-workflow-${workflowId}`,
                    `workflow-${workflowId}`,
                    `n8n-${workflowId}`,
                    workflowId,
                  ];

                  for (const key of storageKeys) {
                    const stored =
                      localStorage.getItem(key) || sessionStorage.getItem(key);
                    if (stored) {
                      try {
                        const parsed = JSON.parse(stored);
                        if (parsed.nodes) {
                          return parsed;
                        }
                      } catch {
                        // ignore parsing errors
                      }
                    }
                  }
                }

                return null;
              } catch (error) {
                console.log("Error in tryGetFromN8nUI:", error);
                return null;
              }
            };

            // Try all methods in order of preference (NO API CALLS to avoid logout issues)
            console.log(
              "🔍 Method 1: Trying to get workflow from internal state..."
            );
            let workflow = tryGetFromState();
            if (workflow) {
              workflow._extractedFrom = "internal-state";
              console.log("✅ Found workflow via internal state!");
            } else {
              console.log("❌ No workflow found in internal state");
            }

            if (!workflow) {
              console.log(
                "🔍 Method 2: Trying to get workflow from DOM parsing..."
              );
              workflow = tryGetFromDOM();
              if (workflow) {
                workflow._extractedFrom = "dom-parsing";
                console.log("✅ Found workflow via DOM parsing!");
              } else {
                console.log("❌ No workflow found in DOM");
              }
            }

            if (!workflow) {
              console.log(
                "🔍 Method 3: Trying to get workflow from n8n UI elements..."
              );
              workflow = tryGetFromN8nUI();
              if (workflow) {
                workflow._extractedFrom = "n8n-ui";
                console.log("✅ Found workflow via n8n UI!");
              } else {
                console.log("❌ No workflow found in n8n UI");
              }
            }

            if (workflow) {
              // Ensure we have the basic workflow structure
              const normalizedWorkflow = {
                name: workflow.name || "Retrieved Workflow",
                nodes: Array.isArray(workflow.nodes) ? workflow.nodes : [],
                connections: workflow.connections || {},
                pinData: workflow.pinData || {},
                settings: workflow.settings || {},
                tags: Array.isArray(workflow.tags) ? workflow.tags : [],
                id: workflow.id,
                active: workflow.active,
                createdAt: workflow.createdAt,
                updatedAt: workflow.updatedAt,
                // Add metadata about extraction method
                _extractedAt: new Date().toISOString(),
                _extractedFrom: workflow._extractedFrom || "unknown",
              };

              console.log(
                "✅ Workflow extracted successfully:",
                normalizedWorkflow.name,
                `(${normalizedWorkflow.nodes.length} nodes)`
              );
              return JSON.stringify(normalizedWorkflow, null, 2);
            }

            // Debug: Log what we tried if nothing worked
            console.log("❌ No workflow found. Debugging info:");
            console.log("- URL:", window.location.href);
            console.log("- Page title:", document.title);
            console.log(
              "- Vue instances found:",
              document.querySelectorAll("[data-app], #app, .vue-flow").length
            );
            console.log(
              "- Canvas elements:",
              document.querySelectorAll(
                '.vue-flow__pane, .n8n-canvas, [data-test-id="canvas"]'
              ).length
            );
            console.log("- Local storage keys:", Object.keys(localStorage));
            console.log("- Session storage keys:", Object.keys(sessionStorage));

            // Check for any global variables that might contain workflow data
            console.log("🔍 Global variables check:");
            const globalVars = [
              "n8n",
              "__VUE__",
              "__PINIA__",
              "workflow",
              "Vue",
            ];
            globalVars.forEach((varName) => {
              if ((window as any)[varName]) {
                console.log(
                  `- Found global.${varName}:`,
                  typeof (window as any)[varName]
                );
              } else {
                console.log(`- No global.${varName}`);
              }
            });

            // Check if we're actually on an n8n page
            const isN8nPage =
              document.querySelector(".n8n-app, [data-n8n], .vue-flow") ||
              document.title.toLowerCase().includes("n8n") ||
              window.location.href.includes("n8n");
            console.log("- Is this an n8n page?", isN8nPage ? "YES" : "NO");

            return null;
          } catch (error) {
            console.log("Error getting workflow:", error);
            return null;
          }
        },
      });

      if (result && result[0]?.result) {
        return result[0].result;
      }

      return null;
    } catch (error) {
      console.log("Error in getWorkflow:", error);
      return null;
    }
  };

  return (
    <div className="size-full min-h-screen bg-background text-foreground">
      <div className="mx-auto size-full max-w-3xl">
        <div className="flex h-[calc(100vh)] flex-col overflow-hidden rounded-xl bg-background shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Assistant</span>
            </div>
            <Badge variant="secondary" className="font-normal">
              {model}
            </Badge>
          </div>
          <Conversation className="h-full">
            <ConversationContent className="pb-24">
              {messages.map((message) => {
                const parts = Array.isArray(
                  (message as { parts?: unknown[] }).parts
                )
                  ? (message as { parts: Array<unknown> }).parts
                  : [];
                const sourceUrls = parts
                  .filter(isSourceUrlPart)
                  .map((p) => p.url);
                const sourceCount = sourceUrls.length;
                return (
                  <div key={message.id}>
                    {message.role === "assistant" && sourceCount > 0 && (
                      <Sources>
                        <SourcesTrigger count={sourceCount} />
                        <SourcesContent>
                          {sourceUrls.map((url, i) => (
                            <Source
                              key={`${message.id}-src-${i}`}
                              href={url}
                              title={url}
                            />
                          ))}
                        </SourcesContent>
                      </Sources>
                    )}
                    <Message
                      from={message.role}
                      className="[&>div]:max-w-[88%] sm:[&>div]:max-w-[75%]"
                    >
                      <MessageContent>
                        {parts.map((part, i) => {
                          if (isTextPart(part)) {
                            return (
                              <Response key={`${message.id}-${i}`}>
                                {part.text}
                              </Response>
                            );
                          }
                          if (isReasoningPart(part)) {
                            return (
                              <Reasoning
                                key={`${message.id}-${i}`}
                                className="w-full"
                                isStreaming={status === "streaming"}
                              >
                                <ReasoningTrigger />
                                <ReasoningContent>{part.text}</ReasoningContent>
                              </Reasoning>
                            );
                          }
                          return null;
                        })}
                      </MessageContent>
                    </Message>
                  </div>
                );
              })}
              {status === "submitted" && (
                <div className="flex justify-center py-2 text-muted-foreground">
                  <Loader />
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
          <div className="sticky bottom-0 z-10 border-t bg-card/80 px-4 pb-4 pt-2 backdrop-blur supports-[backdrop-filter]:bg-card/60">
            <PromptInput
              onSubmit={handleSubmit}
              className="mt-2 border-border/50 bg-card shadow-none"
            >
              <PromptInputTextarea
                onChange={(e) => setInput(e.target.value)}
                value={input}
              />
              <PromptInputToolbar>
                <PromptInputTools>
                  <PromptInputModelSelect
                    onValueChange={(value) => setModel(value)}
                    value={model}
                  >
                    <PromptInputModelSelectTrigger>
                      <PromptInputModelSelectValue />
                    </PromptInputModelSelectTrigger>
                    <PromptInputModelSelectContent>
                      {MODELS.map((m) => (
                        <PromptInputModelSelectItem
                          key={m.value}
                          value={m.value}
                        >
                          {m.name}
                        </PromptInputModelSelectItem>
                      ))}
                    </PromptInputModelSelectContent>
                  </PromptInputModelSelect>
                </PromptInputTools>
                <PromptInputSubmit
                  disabled={input.trim().length === 0}
                  status={status}
                />
              </PromptInputToolbar>
            </PromptInput>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                console.log("🔍 Starting workflow extraction...");
                const result = await getWorkflow();
                if (result) {
                  console.log("✅ SUCCESS! Retrieved workflow:", result);
                  alert(
                    "✅ Workflow retrieved! Check console for the JSON data."
                  );
                } else {
                  console.log("❌ FAILED: No workflow found");
                  alert(
                    "❌ Failed to get workflow. Open browser console (F12) to see what went wrong."
                  );
                }
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              🔍 Get Workflow
            </button>

            <button
              onClick={async () => {
                console.log("🕵️ Exploring n8n page...");
                await browser.scripting.executeScript({
                  target: {
                    tabId: (
                      await browser.tabs.query({
                        active: true,
                        currentWindow: true,
                      })
                    )[0].id!,
                  },
                  world: "MAIN",
                  func: () => {
                    console.log("📍 Page URL:", window.location.href);
                    console.log("📍 Page title:", document.title);
                    console.log(
                      "📍 All global variables:",
                      Object.keys(window)
                    );
                    console.log(
                      "📍 Vue app elements:",
                      document.querySelectorAll(
                        '[id*="app"], [class*="app"], [data-app]'
                      ).length
                    );
                    console.log(
                      "📍 n8n elements:",
                      document.querySelectorAll(
                        '[class*="n8n"], [data-test-id]'
                      ).length
                    );
                    console.log(
                      "📍 Script tags:",
                      document.querySelectorAll("script").length
                    );

                    // Try to find any workflow-related data
                    const possibleWorkflowData = [];
                    for (const key of Object.keys(localStorage)) {
                      if (
                        key.toLowerCase().includes("workflow") ||
                        key.toLowerCase().includes("n8n")
                      ) {
                        possibleWorkflowData.push(`localStorage.${key}`);
                      }
                    }
                    for (const key of Object.keys(sessionStorage)) {
                      if (
                        key.toLowerCase().includes("workflow") ||
                        key.toLowerCase().includes("n8n")
                      ) {
                        possibleWorkflowData.push(`sessionStorage.${key}`);
                      }
                    }
                    console.log(
                      "📍 Possible workflow storage:",
                      possibleWorkflowData
                    );
                  },
                });
                alert("🕵️ Page explored! Check console for details.");
              }}
              className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              🕵️ Explore Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
