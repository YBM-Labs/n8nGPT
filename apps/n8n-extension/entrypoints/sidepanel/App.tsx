"use client";

import React, { useState, useEffect, useRef } from "react";
import { browser } from "wxt/browser";
import { useChat } from "@ai-sdk/react";
import {
  isN8nInstance,
  getN8nCanvasSelectors,
  createN8nHostPermissions,
} from "@/lib/n8n-detector";
// import { GlobeIcon } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  PromptInput,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  generateId,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { authClient } from "@/lib/auth-client";
import AuthPanel from "@/components/auth/authComponent";
import ShinyText from "@/components/ShinyText";
import logo from "@/assets/icon.png";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

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

// Extract JSON block from assistant text (```json ... ``` or first {...} block)
const extractJsonFromText = (text: string): string | null => {
  const fencedJson = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedJson && fencedJson[1]?.trim()) {
    return fencedJson[1].trim();
  }
  const fenced = text.match(/```\s*([\s\S]*?)```/);
  if (fenced && fenced[1]?.trim()) {
    const candidate = fenced[1].trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {}
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const candidate = text.slice(first, last + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {}
  }
  return null;
};

export default function App() {
  const [forceSessionRefresh, setForceSessionRefresh] = useState(0);
  const { data: session, isPending } = authClient.useSession();

  const MODELS: ReadonlyArray<{ name: string; value: string }> = [
    {
      name: "Claude Sonnet 4",
      value: "anthropic/claude-sonnet-4",
    },
    { name: "Gemini 2.0 Flash", value: "google/gemini-2.0-flash-001" },
    { name: "Deepseek R1", value: "deepseek/deepseek-r1" },
    { name: "Grok Code Fast 1", value: "x-ai/grok-code-fast-1" },
    { name: "OpenAI GPT-5", value: "openai/gpt-5" },
    { name: "GLM 4.5", value: "z-ai/glm-4.5" },
  ];

  // Local chat UI state
  const [input, setInput] = useState<string>("");
  const [model, setModel] = useState<string>(
    MODELS[3]?.value ?? "openai/gpt-4o"
  );
  const [webSearch, setWebSearch] = useState<boolean>(false);
  const [isPasting, setIsPasting] = useState<boolean>(false);
  const [generations, setGenerations] = useState<number>(0);
  const [isOnN8n, setIsOnN8n] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const lastAutoPromptedMessageId = useRef<string | null>(null);
  const [isToolCalling, setIsToolCalling] = useState<boolean>(false);

  const signOut = async () => {
    const { error } = await authClient.signOut();
    if (error) {
      console.error(error);
    }
  };

  // Listen for OAuth callback from background script
  useEffect(() => {
    const handleOAuthCallback = async (message: any) => {
      if (message.type === "OAUTH_CALLBACK") {
        console.log("OAuth callback received in App component:", message.url);

        // Wait a bit for the backend to process the OAuth callback
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Force refresh the session
        try {
          await authClient.getSession();
          console.log("Session refreshed in App component");

          // Force component re-render by updating state
          setForceSessionRefresh((prev) => prev + 1);

          // Also try to reload the sidepanel after a short delay
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } catch (error) {
          console.error("Failed to refresh session in App:", error);
          // Even if session refresh fails, reload the page
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      }
    };

    browser.runtime.onMessage.addListener(handleOAuthCallback);

    return () => {
      browser.runtime.onMessage.removeListener(handleOAuthCallback);
    };
  }, []);

  // Keep isOnN8n in sync with active tab
  useEffect(() => {
    const update = async () => {
      try {
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        const url = typeof tab?.url === "string" ? tab.url : "";
        setIsOnN8n(isN8nInstance(url));
      } catch {}
    };
    update();
    const onUpdated = (_tabId: number, changeInfo: any) => {
      if (changeInfo?.url) update();
    };
    const onActivated = () => update();
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onActivated.addListener(onActivated as any);
    return () => {
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onActivated.removeListener(onActivated as any);
    };
  }, []);

  // AI chat hook (expects a backend handler; UI will still render without one)
  const {
    messages,
    sendMessage,
    status,
    addToolResult,
    error,
    stop,
    setMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      api: import.meta.env.VITE_BACKEND_API ?? "http://localhost:5000",
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (error) => {
      console.error("Chat error:", error.message);
      // Check if it's a 403 error (generation limit reached)
      if (error.message) {
        try {
          // Try to parse the error message for generation limit
          const errorText = error.message;
          if (errorText.includes("maximum number of generations")) {
            setGenerationError(
              "You have reached the maximum number of generations for this month. Please wait until the first day of the next month to continue."
            );
          } else {
            setBackendError(
              "You have reached your monthly limit. Please try again next month."
            );
          }
        } catch {
          setBackendError(
            "Backend error occurred while processing your request. Please try again."
          );
        }
      } else {
        setBackendError(
          "An error occurred while processing your request. Please try again."
        );
      }
    },
    onToolCall: async ({ toolCall }) => {
      setIsToolCalling(true);
      try {
        if (toolCall.toolName === "modify_workflow") {
          try {
            let modifications: unknown;
            if (
              typeof toolCall.input === "object" &&
              toolCall.input !== null &&
              "modifications" in (toolCall.input as Record<string, unknown>)
            ) {
              modifications = (toolCall.input as { modifications: unknown })
                .modifications;
            } else if (typeof toolCall.input === "string") {
              try {
                modifications = JSON.parse(toolCall.input);
              } catch {
                throw new Error("Invalid JSON string for modifications");
              }
            } else {
              throw new Error(
                "Invalid tool call input format for modifications"
              );
            }

            const applied = await applyWorkflowModifications(modifications);
            if (applied) {
              const json = await fetchCurrentWorkflow();
              addToolResult({
                tool: "modify_workflow",
                toolCallId: toolCall.toolCallId,
                output: "Workflow modified successfully. New workflow: " + json,
              });
            } else {
              addToolResult({
                tool: "modify_workflow",
                toolCallId: toolCall.toolCallId,
                output: "Failed to modify workflow",
              });
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "modify_workflow",
              toolCallId: toolCall.toolCallId,
              output: `Failed to modify workflow: ${message}`,
            });
          }
          return;
        }

        if (toolCall.toolName === "write_workflow") {
          try {
            let workflowJsonString: string;
            if (typeof toolCall.input === "object" && toolCall.input !== null) {
              const obj = toolCall.input as Record<string, unknown>;
              const candidate =
                (typeof obj["workflowJson"] === "string"
                  ? (obj["workflowJson"] as string)
                  : undefined) ||
                (typeof obj["json"] === "string"
                  ? (obj["json"] as string)
                  : undefined) ||
                (typeof obj["workflow"] === "string"
                  ? (obj["workflow"] as string)
                  : undefined);
              if (typeof candidate !== "string") {
                // If a non-string object is provided, attempt to stringify it
                if (
                  typeof obj["workflow"] === "object" &&
                  obj["workflow"] !== null
                ) {
                  try {
                    workflowJsonString = JSON.stringify(obj["workflow"]);
                  } catch {
                    throw new Error(
                      "Invalid tool call input format: expected JSON string under 'workflowJson' | 'json' | 'workflow'"
                    );
                  }
                } else {
                  throw new Error(
                    "Invalid tool call input format: expected JSON string under 'workflowJson' | 'json' | 'workflow'"
                  );
                }
              } else {
                workflowJsonString = candidate;
              }
            } else if (typeof toolCall.input === "string") {
              workflowJsonString = toolCall.input;
            } else {
              throw new Error(
                "Invalid tool call input format for write_workflow; expected JSON string"
              );
            }

            const applied = await writeWorkflowFromJson(workflowJsonString);
            if (applied) {
              const json = await fetchCurrentWorkflow();
              addToolResult({
                tool: "write_workflow",
                toolCallId: toolCall.toolCallId,
                output: "Workflow written successfully. New workflow: " + json,
              });
            } else {
              addToolResult({
                tool: "write_workflow",
                toolCallId: toolCall.toolCallId,
                output: "Failed to write workflow",
              });
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "write_workflow",
              toolCallId: toolCall.toolCallId,
              output: `Failed to write workflow: ${message}`,
            });
          }
          return;
        }

        if (toolCall.toolName === "get_current_workflow") {
          try {
            const json = await fetchCurrentWorkflow();
            if (typeof json === "string" && json.length > 0) {
              addToolResult({
                tool: "get_current_workflow",
                toolCallId: toolCall.toolCallId,
                output: json,
              });
            } else {
              addToolResult({
                tool: "get_current_workflow",
                toolCallId: toolCall.toolCallId,
                output: "No workflow found",
              });
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "get_current_workflow",
              toolCallId: toolCall.toolCallId,
              output: `Failed to retrieve workflow: ${message}`,
            });
          }
          return;
        }

        if (toolCall.toolName === "delete_workflow") {
          try {
            const applied = await deleteCurrentWorkflowOnPage();
            if (applied) {
              const json = await fetchCurrentWorkflow();
              addToolResult({
                tool: "delete_workflow",
                toolCallId: toolCall.toolCallId,
                output: "Workflow deleted/cleared successfully.",
              });
            } else {
              addToolResult({
                tool: "delete_workflow",
                toolCallId: toolCall.toolCallId,
                output: "Failed to delete workflow",
              });
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "delete_workflow",
              toolCallId: toolCall.toolCallId,
              output: `Failed to delete workflow: ${message}`,
            });
          }
          return;
        }

        if (toolCall.toolName === "add_node") {
          try {
            let nodeType = "";
            let nodeName = "";
            let parameters: Record<string, unknown> = {};
            let position: [number, number] = [0, 0];
            if (typeof toolCall.input === "object" && toolCall.input !== null) {
              const obj = toolCall.input as Record<string, unknown>;
              nodeType = String(obj["nodeType"] ?? "");
              nodeName = String(obj["nodeName"] ?? "");
              parameters = (obj["parameters"] as Record<string, unknown>) ?? {};
              const pos = obj["position"] as unknown;
              if (
                Array.isArray(pos) &&
                pos.length === 2 &&
                typeof pos[0] === "number" &&
                typeof pos[1] === "number"
              ) {
                position = [pos[0], pos[1]];
              }
            } else {
              throw new Error("Invalid input for add_node");
            }

            const addedId = await addNodeOnPage({
              nodeType,
              nodeName,
              parameters,
              position,
            });
            if (typeof addedId === "string" && addedId.length > 0) {
              const json = await fetchCurrentWorkflow();
              addToolResult({
                tool: "add_node",
                toolCallId: toolCall.toolCallId,
                output: `Node added successfully with id ${addedId}`,
              });
            } else {
              addToolResult({
                tool: "add_node",
                toolCallId: toolCall.toolCallId,
                output: "Failed to add node",
              });
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "add_node",
              toolCallId: toolCall.toolCallId,
              output: `Failed to add node: ${message}`,
            });
          }
          return;
        }

        if (toolCall.toolName === "delete_node") {
          try {
            if (
              typeof toolCall.input !== "object" ||
              toolCall.input === null ||
              typeof (toolCall.input as Record<string, unknown>)["nodeId"] !==
                "string"
            ) {
              throw new Error("Invalid input for delete_node; expected nodeId");
            }
            const nodeId = String(
              (toolCall.input as Record<string, unknown>)["nodeId"]
            );
            const ok = await deleteNodeOnPage({ nodeId });
            if (ok) {
              const json = await fetchCurrentWorkflow();
              addToolResult({
                tool: "delete_node",
                toolCallId: toolCall.toolCallId,
                output: `Node ${nodeId} deleted successfully`,
              });
            } else {
              addToolResult({
                tool: "delete_node",
                toolCallId: toolCall.toolCallId,
                output: "Failed to delete node",
              });
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "delete_node",
              toolCallId: toolCall.toolCallId,
              output: `Failed to delete node: ${message}`,
            });
          }
          return;
        }
      } finally {
        setIsToolCalling(false);
      }
    },
  });

  // When assistant finishes a response, try to extract JSON from it and prompt immediately
  // useEffect(() => {
  //   if (!isOnN8n) return;
  //   if (status === "streaming") return;
  //   if (messages.length === 0) return;
  //   const last = messages[messages.length - 1] as unknown as {
  //     role?: string;
  //     id: string;
  //     parts?: unknown[];
  //   };
  //   if (last?.role !== "assistant") return;
  //   if (lastAutoPromptedMessageId.current === last.id) return;
  //   const parts = Array.isArray(last.parts) ? (last.parts as unknown[]) : [];
  //   const text = parts
  //     .filter(isTextPart)
  //     .map((p: unknown) => (p as TextPart).text)
  //     .join("\n");
  //   if (!text) return;
  //   const json = extractJsonFromText(text);
  //   if (json) {
  //     lastAutoPromptedMessageId.current = last.id;
  //   }
  // }, [messages, status, isOnN8n]);

  useEffect(() => {
    const getGenerations = async () => {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/generations`
      );
      const data = await response.json();
      setGenerations(data.generations);
    };
    getGenerations();
  }, [session, status === "ready"]);

  /**
   * Handle prompt submission. Prevent default form post and dispatch to useChat.
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!isOnN8n) return;
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return;
    }

    // Clear any previous generation errors
    setGenerationError(null);

    // if (workflowJson) {
    //   setMessages((prevMessages) => [
    //     ...prevMessages,
    //     {
    //       id: generateId(),
    //       role: "system",
    //       parts: [
    //         {
    //           type: "text",
    //           text: "This is the current workflow present on the n8n canvas.",
    //         },
    //         {
    //           type: "data-json",
    //           data: workflowJson,
    //         },
    //       ],
    //     },
    //   ]);
    // }

    sendMessage(
      {
        parts: [
          {
            type: "text",
            text: trimmed,
          },
        ],
      },
      {
        body: {
          model,
          webSearch,
          // workflowJson,
        },
      }
    );

    setInput("");
  };

  /**
   * Apply workflow modifications in the active n8n tab. Accepts a generic object
   * with optional keys: nodes (array), connections (object), updateNode (object).
   */
  const applyWorkflowModifications = async (
    modifications: unknown
  ): Promise<boolean> => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      const tabId = typeof tab?.id === "number" ? tab.id : null;
      const tabUrl = typeof tab?.url === "string" ? tab.url : "";

      if (tabId === null || tabUrl.length === 0) {
        throw new Error("No active tab found");
      }

      if (!isN8nInstance(tabUrl)) {
        throw new Error(
          "Current tab is not an n8n instance. Please navigate to an n8n workflow page."
        );
      }

      const url = new URL(tabUrl);

      // Best-effort host permissions request (non-blocking)
      try {
        const hostPermissions = createN8nHostPermissions(url.hostname);
        const hasPermission = await browser.permissions.contains({
          origins: hostPermissions,
        });
        if (!hasPermission) {
          try {
            await browser.permissions.request({ origins: hostPermissions });
          } catch {}
        }
      } catch {}

      const result = await browser.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: (mods: any) => {
          try {
            const allElements = document.querySelectorAll("*");
            for (const el of Array.from(allElements) as any[]) {
              const vueInstance =
                (el as any).__vueParentComponent ||
                (el as any)._vnode?.component;
              if (vueInstance?.appContext) {
                const globals =
                  vueInstance.appContext.app.config.globalProperties;
                const workflowsStore = globals?.$pinia?._s?.get
                  ? globals.$pinia._s.get("workflows")
                  : globals?.$pinia?._s?.["workflows"];
                const vueFlowStorage = (globals as any)?.$vueFlowStorage as
                  | {
                      flows?: Map<
                        string,
                        {
                          nodes: { value: Array<any> };
                          edges: { value: Array<any> };
                        }
                      >;
                    }
                  | undefined;

                const currentWorkflow = (workflowsStore as any)?.workflow as
                  | {
                      nodes?: Array<any>;
                      connections?: Record<string, any>;
                    }
                  | undefined;
                if (!currentWorkflow || !Array.isArray(currentWorkflow.nodes)) {
                  continue;
                }

                // Do NOT add nodes here; modify_workflow only updates existing items

                // Track if connections changed
                let connectionsChanged = false;

                // Merge connections if provided
                if (
                  mods &&
                  mods.connections &&
                  typeof mods.connections === "object"
                ) {
                  currentWorkflow.connections = {
                    ...(currentWorkflow.connections ?? {}),
                    ...(mods.connections as Record<string, unknown>),
                  } as Record<string, any>;
                  connectionsChanged = true;
                }

                // Update an existing node's parameters (preserve connections)
                if (
                  mods &&
                  mods.updateNode &&
                  typeof mods.updateNode === "object"
                ) {
                  const id = (mods.updateNode as { id?: string }).id;
                  if (typeof id === "string" && id.length > 0) {
                    const idx = currentWorkflow.nodes.findIndex(
                      (n: any) => n && n.id === id
                    );
                    if (idx !== -1) {
                      const candidate = mods.updateNode as Record<string, any>;
                      const oldName = (currentWorkflow.nodes[idx] as any)
                        .name as string | undefined;
                      const newName =
                        typeof candidate.name === "string" &&
                        candidate.name.length > 0
                          ? (candidate.name as string)
                          : undefined;
                      const hadNameUpdate =
                        typeof oldName === "string" &&
                        typeof newName === "string" &&
                        oldName !== newName;
                      // Only merge parameters to avoid clobbering other fields
                      if (
                        candidate.parameters &&
                        typeof candidate.parameters === "object"
                      ) {
                        const existingParams = (
                          currentWorkflow.nodes[idx] as any
                        ).parameters;
                        if (
                          existingParams &&
                          typeof existingParams === "object"
                        ) {
                          Object.assign(existingParams, candidate.parameters);
                        } else {
                          (currentWorkflow.nodes[idx] as any).parameters = {
                            ...(candidate.parameters as Record<
                              string,
                              unknown
                            >),
                          };
                        }
                      }

                      // Optionally merge a few safe top-level fields
                      const safeTopLevel: Array<string> = [
                        "name",
                        "typeVersion",
                        "disabled",
                      ];
                      for (const key of safeTopLevel) {
                        if (key in candidate) {
                          (currentWorkflow.nodes[idx] as any)[key] =
                            candidate[key];
                        }
                      }

                      // Update Vue Flow node data.parameters to keep UI in sync
                      const flow = vueFlowStorage?.flows?.get("__EMPTY__");
                      if (flow && Array.isArray(flow.nodes?.value)) {
                        const vfIdx = flow.nodes.value.findIndex(
                          (n: any) => n && n.id === id
                        );
                        if (vfIdx !== -1) {
                          const vfData = flow.nodes.value[vfIdx]?.data as
                            | {
                                parameters?: Record<string, unknown>;
                                name?: string;
                              }
                            | undefined;
                          if (
                            vfData &&
                            typeof vfData === "object" &&
                            vfData.parameters &&
                            typeof vfData.parameters === "object" &&
                            (mods.updateNode as any).parameters &&
                            typeof (mods.updateNode as any).parameters ===
                              "object"
                          ) {
                            Object.assign(
                              vfData.parameters,
                              (mods.updateNode as any).parameters
                            );
                          }
                          // If name changed, update label and data.name
                          if (hadNameUpdate && typeof newName === "string") {
                            (flow.nodes.value[vfIdx] as any).label = newName;
                            if (vfData && typeof vfData === "object") {
                              (vfData as any).name = newName;
                            }
                          }
                        }
                      }

                      // Auto-update connection references and keys when node name changes (unless disabled)
                      if (
                        hadNameUpdate &&
                        !((mods as any).autoUpdateConnections === false)
                      ) {
                        const nextConnections: Record<string, any> = {
                          ...(currentWorkflow.connections ?? {}),
                        };

                        if (
                          Object.prototype.hasOwnProperty.call(
                            nextConnections,
                            oldName as string
                          )
                        ) {
                          nextConnections[newName as string] =
                            nextConnections[oldName as string];
                          delete nextConnections[oldName as string];
                        }

                        for (const key of Object.keys(nextConnections)) {
                          const nodeConnections = nextConnections[key] as
                            | Record<string, any>
                            | undefined;
                          if (
                            !nodeConnections ||
                            typeof nodeConnections !== "object"
                          )
                            continue;
                          for (const outputType of Object.keys(
                            nodeConnections
                          )) {
                            const arr = nodeConnections[outputType];
                            if (!Array.isArray(arr)) continue;
                            arr.forEach((connectionArray: any[]) => {
                              if (!Array.isArray(connectionArray)) return;
                              connectionArray.forEach(
                                (connection: Record<string, any>) => {
                                  if (
                                    connection &&
                                    connection.node === oldName
                                  ) {
                                    connection.node = newName;
                                  }
                                }
                              );
                            });
                          }
                        }

                        currentWorkflow.connections = nextConnections;
                        connectionsChanged = true;
                      }
                    }
                  }
                }

                // If connections changed, rebuild Vue Flow edges
                if (connectionsChanged) {
                  const flow = vueFlowStorage?.flows?.get("__EMPTY__");
                  if (flow) {
                    const vueFlowEdges: Array<Record<string, unknown>> = [];
                    const wfNodes = Array.isArray(currentWorkflow.nodes)
                      ? (currentWorkflow.nodes as Array<Record<string, any>>)
                      : [];
                    const connections = (currentWorkflow.connections ??
                      {}) as Record<string, any>;
                    for (const sourceNodeName of Object.keys(connections)) {
                      const sourceConnections = connections[sourceNodeName] as
                        | Record<string, Array<Array<Record<string, any>>>>
                        | undefined;
                      if (!sourceConnections) continue;
                      for (const outputType of Object.keys(sourceConnections)) {
                        const arr = sourceConnections[outputType];
                        if (!Array.isArray(arr)) continue;
                        arr.forEach((connectionArray, arrayIndex) => {
                          if (!Array.isArray(connectionArray)) return;
                          connectionArray.forEach((connection) => {
                            const sourceNode = wfNodes.find(
                              (n) => String(n["name"]) === sourceNodeName
                            );
                            const targetNodeName = String(
                              connection["node"] ?? ""
                            );
                            const targetNode = wfNodes.find(
                              (n) => String(n["name"]) === targetNodeName
                            );
                            if (sourceNode && targetNode) {
                              const srcId = String(sourceNode["id"] ?? "");
                              const tgtId = String(targetNode["id"] ?? "");
                              const connType = String(
                                connection["type"] ?? "main"
                              );
                              const connIndex = Number(
                                connection["index"] ?? 0
                              );
                              vueFlowEdges.push({
                                id: `${srcId}-${tgtId}-${Date.now()}`,
                                source: srcId,
                                target: tgtId,
                                sourceHandle: `outputs/${outputType}/${arrayIndex}`,
                                targetHandle: `inputs/${connType}/${connIndex}`,
                              });
                            }
                          });
                        });
                      }
                    }

                    flow.edges.value.splice(
                      0,
                      flow.edges.value.length,
                      ...vueFlowEdges
                    );
                  }
                }

                // Trigger reactivity update
                if (typeof (workflowsStore as any)?.$patch === "function") {
                  (workflowsStore as any).$patch({
                    workflow: currentWorkflow,
                  });
                } else {
                  (workflowsStore as any).workflow = currentWorkflow;
                }

                return {
                  success: true,
                  message: "Workflow modified successfully",
                };
              }
            }
            return {
              success: false,
              message: "Could not access Vue app context",
            };
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            return { success: false, message: msg };
          }
        },
        args: [modifications],
      });

      const scriptResult = result?.[0]?.result as
        | { success: boolean; message: string }
        | undefined;
      if (!scriptResult?.success) {
        throw new Error(scriptResult?.message || "Script execution failed");
      }
      return true;
    } catch (err) {
      console.error("Modify workflow error:", err);
      return false;
    }
  };

  // overwriteCurrentWorkflow removed

  /**
   * Execute a script in the active n8n tab to extract the current workflow
   * in a simplified export format. Returns a JSON string or null if not found.
   */
  const fetchCurrentWorkflow = async (): Promise<string | null> => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      const tabId = typeof tab?.id === "number" ? tab.id : null;
      const tabUrl = typeof tab?.url === "string" ? tab.url : "";

      if (tabId === null || tabUrl.length === 0) {
        throw new Error("No active tab found");
      }

      const url = new URL(tabUrl);

      // Best-effort host permissions request (non-blocking)
      try {
        const hostPermissions = createN8nHostPermissions(url.hostname);
        const hasPermission = await browser.permissions.contains({
          origins: hostPermissions,
        });
        if (!hasPermission) {
          try {
            await browser.permissions.request({ origins: hostPermissions });
          } catch {}
        }
      } catch {}

      const results = await browser.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () => {
          try {
            const allElements = document.querySelectorAll("*");
            for (const el of Array.from(allElements)) {
              // Access Vue component instance from DOM element
              // @ts-ignore - accessing non-standard Vue internals on DOM element
              // Use 'any' for el to access Vue internals without TypeScript errors
              const vueInstance =
                (el as any).__vueParentComponent ||
                (el as any)._vnode?.component;
              // @ts-ignore - vue internals may be undefined
              if (vueInstance?.appContext) {
                // @ts-ignore - globalProperties is not typed here
                const globals =
                  vueInstance.appContext.app.config.globalProperties;
                // @ts-ignore - pinia internals used to locate the workflows store
                const workflowsStore = globals?.$pinia?._s?.get("workflows");
                // @ts-ignore - get workflow object from store
                const fullWorkflow = workflowsStore?.workflow;

                if (!fullWorkflow) {
                  continue;
                }

                const nodesArray = Array.isArray(fullWorkflow.nodes)
                  ? fullWorkflow.nodes
                  : [];

                // Build simplified export format
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const exportNodes = nodesArray.map((node: any) => {
                  const exportNode: {
                    parameters: object;
                    type: string;
                    typeVersion: number;
                    position: [number, number];
                    id: string;
                    name: string;
                    webhookId?: string;
                  } = {
                    parameters: (node && node.parameters) || {},
                    type: (node && node.type) || "",
                    typeVersion: (node && node.typeVersion) || 1,
                    position: (node && node.position) || [0, 0],
                    id: (node && node.id) || "",
                    name: (node && node.name) || "",
                  };
                  if (node && node.webhookId) {
                    exportNode.webhookId = node.webhookId as string;
                  }
                  return exportNode;
                });

                const exportFormat = {
                  nodes: exportNodes,
                  // Use fallbacks to plain objects if missing
                  connections: (fullWorkflow && fullWorkflow.connections) || {},
                  pinData: (fullWorkflow && fullWorkflow.pinData) || {},
                  meta: {
                    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                    instanceId:
                      (fullWorkflow &&
                        fullWorkflow.meta &&
                        fullWorkflow.meta.instanceId) ||
                      null,
                    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                    ...(fullWorkflow &&
                    fullWorkflow.meta &&
                    fullWorkflow.meta.templateCredsSetupCompleted
                      ? { templateCredsSetupCompleted: true }
                      : {}),
                  },
                };

                return JSON.stringify(exportFormat);
              }
            }
            return null;
          } catch {
            return null;
          }
        },
      });

      const workflowJsonString =
        typeof results?.[0]?.result === "string" ? results[0].result : null;
      return workflowJsonString ?? null;
    } catch (err) {
      console.error("Fetch current workflow error:", err);
      throw err instanceof Error ? err : new Error("Unknown error occurred");
    }
  };

  const addNodeOnPage = async ({
    nodeType,
    nodeName,
    parameters,
    position,
  }: {
    nodeType: string;
    nodeName: string;
    parameters: Record<string, unknown>;
    position: [number, number];
  }): Promise<string | false> => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const tabId = typeof tab?.id === "number" ? tab.id : null;
      const tabUrl = typeof tab?.url === "string" ? tab.url : "";
      if (tabId === null || tabUrl.length === 0) {
        throw new Error("No active tab found");
      }
      if (!isN8nInstance(tabUrl)) {
        throw new Error(
          "Current tab is not an n8n instance. Please navigate to an n8n workflow page."
        );
      }
      const url = new URL(tabUrl);
      try {
        const hostPermissions = createN8nHostPermissions(url.hostname);
        const hasPermission = await browser.permissions.contains({
          origins: hostPermissions,
        });
        if (!hasPermission) {
          try {
            await browser.permissions.request({ origins: hostPermissions });
          } catch {}
        }
      } catch {}

      const result = await browser.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: (payload: {
          nodeType: string;
          nodeName: string;
          parameters: Record<string, unknown>;
          position: [number, number];
        }) => {
          try {
            const allElements = document.querySelectorAll("*");
            for (const el of Array.from(allElements) as any[]) {
              const vueInstance =
                (el as any).__vueParentComponent ||
                (el as any)._vnode?.component;
              if (vueInstance?.appContext) {
                const globals =
                  vueInstance.appContext.app.config.globalProperties;
                const workflowsStore = globals?.$pinia?._s?.get
                  ? globals.$pinia._s.get("workflows")
                  : globals?.$pinia?._s?.["workflows"];
                const vueFlowStorage = (globals as any)?.$vueFlowStorage as
                  | {
                      flows?: Map<
                        string,
                        {
                          nodes: { value: Array<any> };
                          edges: { value: Array<any> };
                        }
                      >;
                    }
                  | undefined;
                const currentWorkflow = (workflowsStore as any)?.workflow as
                  | { nodes?: Array<any> }
                  | undefined;
                if (!currentWorkflow || !Array.isArray(currentWorkflow.nodes)) {
                  continue;
                }

                const getNodeTypeVersion = (type: string): number => {
                  const versions: Record<string, number> = {
                    "n8n-nodes-base.manualTrigger": 1,
                    "n8n-nodes-base.httpRequest": 4.2,
                    "n8n-nodes-base.set": 3.4,
                    "n8n-nodes-base.stickyNote": 1,
                    "@n8n/n8n-nodes-langchain.agent": 1.8,
                    "@n8n/n8n-nodes-langchain.chatTrigger": 1.1,
                  };
                  return typeof versions[type] === "number"
                    ? versions[type]
                    : 1;
                };

                const newNodeId = `node-${Date.now()}-${Math.random()
                  .toString(36)
                  .slice(2, 11)}`;
                const newNode = {
                  parameters: payload.parameters ?? {},
                  type: payload.nodeType,
                  typeVersion: getNodeTypeVersion(payload.nodeType),
                  position: payload.position,
                  id: newNodeId,
                  name: payload.nodeName,
                  disabled: false,
                } as Record<string, unknown>;

                currentWorkflow.nodes.push(newNode);

                const flow = vueFlowStorage?.flows?.get("__EMPTY__");
                if (flow) {
                  const vueFlowNode = {
                    id: newNodeId,
                    type: "canvas-node",
                    position: {
                      x: Number(payload.position?.[0] ?? 0),
                      y: Number(payload.position?.[1] ?? 0),
                    },
                    data: newNode,
                    label: payload.nodeName,
                  } as Record<string, unknown>;
                  flow.nodes.value.push(vueFlowNode);
                }

                if (typeof (workflowsStore as any).$patch === "function") {
                  (workflowsStore as any).$patch({ workflow: currentWorkflow });
                } else {
                  (workflowsStore as any).workflow = currentWorkflow;
                }

                return { success: true, nodeId: newNodeId };
              }
            }
            return { success: false, nodeId: null };
          } catch (e) {
            return { success: false, nodeId: null };
          }
        },
        args: [
          {
            nodeType,
            nodeName,
            parameters,
            position,
          },
        ],
      });

      const scriptResult = result?.[0]?.result as
        | { success: boolean; nodeId: string | null }
        | undefined;
      if (!scriptResult?.success || typeof scriptResult.nodeId !== "string") {
        return false;
      }
      return scriptResult.nodeId;
    } catch (err) {
      console.error("Add node error:", err);
      return false;
    }
  };

  const deleteNodeOnPage = async ({
    nodeId,
  }: {
    nodeId: string;
  }): Promise<boolean> => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const tabId = typeof tab?.id === "number" ? tab.id : null;
      const tabUrl = typeof tab?.url === "string" ? tab.url : "";
      if (tabId === null || tabUrl.length === 0) {
        throw new Error("No active tab found");
      }
      if (!isN8nInstance(tabUrl)) {
        throw new Error(
          "Current tab is not an n8n instance. Please navigate to an n8n workflow page."
        );
      }
      const url = new URL(tabUrl);
      try {
        const hostPermissions = createN8nHostPermissions(url.hostname);
        const hasPermission = await browser.permissions.contains({
          origins: hostPermissions,
        });
        if (!hasPermission) {
          try {
            await browser.permissions.request({ origins: hostPermissions });
          } catch {}
        }
      } catch {}

      const result = await browser.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: (payload: { nodeId: string }) => {
          try {
            const allElements = document.querySelectorAll("*");
            for (const el of Array.from(allElements) as any[]) {
              const vueInstance =
                (el as any).__vueParentComponent ||
                (el as any)._vnode?.component;
              if (vueInstance?.appContext) {
                const globals =
                  vueInstance.appContext.app.config.globalProperties;
                const workflowsStore = globals?.$pinia?._s?.get
                  ? globals.$pinia._s.get("workflows")
                  : globals?.$pinia?._s?.["workflows"];
                const vueFlowStorage = (globals as any)?.$vueFlowStorage as
                  | {
                      flows?: Map<
                        string,
                        {
                          nodes: { value: Array<any> };
                          edges: { value: Array<any> };
                        }
                      >;
                    }
                  | undefined;
                const currentWorkflow = (workflowsStore as any)?.workflow as
                  | { nodes?: Array<any>; connections?: Record<string, any> }
                  | undefined;
                if (!currentWorkflow || !Array.isArray(currentWorkflow.nodes)) {
                  continue;
                }

                const idx = currentWorkflow.nodes.findIndex(
                  (n: any) => n && n.id === payload.nodeId
                );
                if (idx === -1) {
                  return { success: false };
                }
                const nodeName = String(
                  (currentWorkflow.nodes[idx] as any)?.name ?? ""
                );

                currentWorkflow.nodes = currentWorkflow.nodes.filter(
                  (n: any) => n && n.id !== payload.nodeId
                );

                const nextConnections: Record<string, any> = {
                  ...(currentWorkflow.connections ?? {}),
                };
                if (
                  Object.prototype.hasOwnProperty.call(
                    nextConnections,
                    nodeName
                  )
                ) {
                  delete nextConnections[nodeName];
                }
                for (const sourceNodeName of Object.keys(nextConnections)) {
                  const sourceConnections = nextConnections[sourceNodeName] as
                    | Record<string, Array<Array<Record<string, any>>>>
                    | undefined;
                  if (!sourceConnections) continue;
                  for (const outputType of Object.keys(sourceConnections)) {
                    const arr = sourceConnections[outputType];
                    if (!Array.isArray(arr)) continue;
                    const cleaned = arr
                      .map((connectionArray) =>
                        Array.isArray(connectionArray)
                          ? connectionArray.filter(
                              (connection) =>
                                connection && connection.node !== nodeName
                            )
                          : []
                      )
                      .filter(
                        (connectionArray) =>
                          Array.isArray(connectionArray) &&
                          connectionArray.length > 0
                      );
                    if (cleaned.length > 0) {
                      sourceConnections[outputType] = cleaned;
                    } else {
                      delete sourceConnections[outputType];
                    }
                  }
                  if (Object.keys(sourceConnections).length === 0) {
                    delete nextConnections[sourceNodeName];
                  }
                }
                currentWorkflow.connections = nextConnections;

                const flow = vueFlowStorage?.flows?.get("__EMPTY__");
                if (flow) {
                  flow.nodes.value = flow.nodes.value.filter(
                    (n: any) => n && n.id !== payload.nodeId
                  );
                  flow.edges.value = flow.edges.value.filter(
                    (edge: any) =>
                      edge &&
                      edge.source !== payload.nodeId &&
                      edge.target !== payload.nodeId
                  );
                }

                if (typeof (workflowsStore as any).$patch === "function") {
                  (workflowsStore as any).$patch({ workflow: currentWorkflow });
                } else {
                  (workflowsStore as any).workflow = currentWorkflow;
                }

                return { success: true };
              }
            }
            return { success: false };
          } catch (e) {
            return { success: false };
          }
        },
        args: [{ nodeId }],
      });

      const scriptResult = result?.[0]?.result as
        | { success: boolean }
        | undefined;
      if (!scriptResult?.success) {
        return false;
      }
      return true;
    } catch (err) {
      console.error("Delete node error:", err);
      return false;
    }
  };

  /**
   * Delete/Clear the current workflow on the active n8n tab.
   */
  const deleteCurrentWorkflowOnPage = async (): Promise<boolean> => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      const tabId = typeof tab?.id === "number" ? tab.id : null;
      const tabUrl = typeof tab?.url === "string" ? tab.url : "";

      if (tabId === null || tabUrl.length === 0) {
        throw new Error("No active tab found");
      }

      if (!isN8nInstance(tabUrl)) {
        throw new Error(
          "Current tab is not an n8n instance. Please navigate to an n8n workflow page."
        );
      }

      const url = new URL(tabUrl);

      // Best-effort host permissions request (non-blocking)
      try {
        const hostPermissions = createN8nHostPermissions(url.hostname);
        const hasPermission = await browser.permissions.contains({
          origins: hostPermissions,
        });
        if (!hasPermission) {
          try {
            await browser.permissions.request({ origins: hostPermissions });
          } catch {}
        }
      } catch {}

      const result = await browser.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () => {
          try {
            const allElements = document.querySelectorAll("*");
            for (const el of Array.from(allElements) as any[]) {
              const vueInstance =
                (el as any).__vueParentComponent ||
                (el as any)._vnode?.component;
              if (vueInstance?.appContext) {
                const globals =
                  vueInstance.appContext.app.config.globalProperties;
                const workflowsStore = globals?.$pinia?._s?.get
                  ? globals.$pinia._s.get("workflows")
                  : globals?.$pinia?._s?.["workflows"];
                const vueFlowStorage = (globals as any)?.$vueFlowStorage as
                  | {
                      flows?: Map<
                        string,
                        {
                          nodes: { value: Array<any> };
                          edges: { value: Array<any> };
                        }
                      >;
                    }
                  | undefined;

                if (!workflowsStore || !vueFlowStorage) {
                  continue;
                }

                const emptyWorkflow = {
                  id: null,
                  name: "New Workflow",
                  active: false,
                  nodes: [] as Array<unknown>,
                  connections: {} as Record<string, unknown>,
                  settings: {
                    executionOrder: "v1",
                  },
                  tags: [] as Array<unknown>,
                  pinData: {} as Record<string, unknown>,
                  meta: {
                    instanceId: null as string | null,
                  },
                };

                try {
                  if (typeof (workflowsStore as any).$patch === "function") {
                    (workflowsStore as any).$patch({ workflow: emptyWorkflow });
                  } else {
                    (workflowsStore as any).workflow = emptyWorkflow;
                  }

                  const flow = vueFlowStorage.flows?.get("__EMPTY__");
                  if (flow) {
                    flow.nodes.value.splice(0, flow.nodes.value.length);
                    flow.edges.value.splice(0, flow.edges.value.length);
                  }

                  // eslint-disable-next-line no-console
                  console.log("Workflow deleted/cleared successfully");
                  return { success: true, message: "ok" };
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Unknown error";
                  return { success: false, message: msg };
                }
              }
            }
            return { success: false, message: "Vue instance not found" };
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            return { success: false, message: msg };
          }
        },
      });

      const scriptResult = result?.[0]?.result as
        | { success: boolean; message: string }
        | undefined;
      if (!scriptResult?.success) {
        throw new Error(scriptResult?.message || "Script execution failed");
      }
      return true;
    } catch (err) {
      console.error("Delete workflow error:", err);
      return false;
    }
  };

  /**
   * Write a workflow to the active n8n tab from a JSON string.
   * Safely updates the Pinia store and Vue Flow state.
   */
  const writeWorkflowFromJson = async (
    workflowJsonString: string
  ): Promise<boolean> => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      const tabId = typeof tab?.id === "number" ? tab.id : null;
      const tabUrl = typeof tab?.url === "string" ? tab.url : "";

      if (tabId === null || tabUrl.length === 0) {
        throw new Error("No active tab found");
      }

      if (!isN8nInstance(tabUrl)) {
        throw new Error(
          "Current tab is not an n8n instance. Please navigate to an n8n workflow page."
        );
      }

      const url = new URL(tabUrl);

      // Best-effort host permissions request (non-blocking)
      try {
        const hostPermissions = createN8nHostPermissions(url.hostname);
        const hasPermission = await browser.permissions.contains({
          origins: hostPermissions,
        });
        if (!hasPermission) {
          try {
            await browser.permissions.request({ origins: hostPermissions });
          } catch {}
        }
      } catch {}

      const result = await browser.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: (json: string) => {
          try {
            const workflow = JSON.parse(json);

            // inner helper similar to updateWorkflowSafely but accepts parsed workflow
            function applyWorkflow(workflowObj: unknown): boolean {
              try {
                const allElements = document.querySelectorAll("*");
                for (const el of Array.from(allElements)) {
                  const anyEl = el as unknown as {
                    __vueParentComponent?: {
                      appContext?: {
                        app: {
                          config: { globalProperties: Record<string, unknown> };
                        };
                      };
                    };
                    _vnode?: {
                      component?: {
                        appContext?: {
                          app: {
                            config: {
                              globalProperties: Record<string, unknown>;
                            };
                          };
                        };
                      };
                    };
                  };
                  const vueInstance =
                    anyEl.__vueParentComponent || anyEl._vnode?.component;
                  if (
                    vueInstance &&
                    (vueInstance as { appContext?: unknown }).appContext
                  ) {
                    const globals = (
                      vueInstance as {
                        appContext: {
                          app: {
                            config: {
                              globalProperties: Record<string, unknown>;
                            };
                          };
                        };
                      }
                    ).appContext.app.config.globalProperties;
                    const pinia = globals?.["$pinia"] as
                      | { _s?: Map<string, unknown> & Record<string, unknown> }
                      | undefined;
                    const workflowsStore =
                      pinia &&
                      ((typeof pinia._s?.get === "function"
                        ? (pinia._s as Map<string, unknown>).get("workflows")
                        : (pinia._s as Record<string, unknown> | undefined)?.[
                            "workflows"
                          ]) as
                        | {
                            $patch?: (payload: Record<string, unknown>) => void;
                            workflow?: unknown;
                          }
                        | undefined);
                    const vueFlowStorage = globals?.["$vueFlowStorage"] as
                      | {
                          flows?: Map<
                            string,
                            {
                              nodes: { value: Array<unknown> };
                              edges: { value: Array<unknown> };
                            }
                          >;
                        }
                      | undefined;

                    if (!workflowsStore || !vueFlowStorage) {
                      continue;
                    }

                    const wfObj = workflowObj as {
                      nodes?: Array<Record<string, unknown>>;
                      connections?: Record<string, unknown>;
                    };
                    if (!wfObj || !Array.isArray(wfObj.nodes)) {
                      return false;
                    }

                    // Update store
                    if (typeof workflowsStore.$patch === "function") {
                      workflowsStore.$patch({ workflow: wfObj });
                    } else {
                      (workflowsStore as { workflow?: unknown }).workflow =
                        wfObj;
                    }

                    // Sync Vue Flow
                    const flow = vueFlowStorage.flows?.get("__EMPTY__");
                    if (flow) {
                      const vueFlowNodes = wfObj.nodes.map((node) => {
                        const id = String(node["id"] ?? "");
                        const name = String(node["name"] ?? "");
                        const type = String(node["type"] ?? "");
                        const typeVersion = Number(node["typeVersion"] ?? 1);
                        const posArr = Array.isArray(node["position"])
                          ? (node["position"] as Array<number>)
                          : [0, 0];
                        const disabled = Boolean(node["disabled"] ?? false);
                        const parameters =
                          (node["parameters"] as Record<string, unknown>) ?? {};
                        const inputs = Array.isArray(
                          (node as Record<string, unknown>)["inputs"]
                        )
                          ? ((node as Record<string, unknown>)[
                              "inputs"
                            ] as Array<unknown>)
                          : [];
                        const outputs = Array.isArray(
                          (node as Record<string, unknown>)["outputs"]
                        )
                          ? ((node as Record<string, unknown>)[
                              "outputs"
                            ] as Array<Record<string, unknown>>)
                          : [{ type: "main", index: 0 }];
                        const webhookId =
                          typeof (node as Record<string, unknown>)[
                            "webhookId"
                          ] === "string"
                            ? String(
                                (node as Record<string, unknown>)["webhookId"]
                              )
                            : undefined;
                        const isTrigger =
                          typeof type === "string"
                            ? type.includes("trigger")
                            : false;

                        return {
                          id,
                          type: "canvas-node",
                          dimensions: { width: 100, height: 100 },
                          computedPosition: {
                            x: Number(posArr[0] ?? 0),
                            y: Number(posArr[1] ?? 0),
                            z: 1000,
                          },
                          handleBounds: {
                            source: [
                              {
                                id: "outputs/main/0",
                                position: "right",
                                nodeId: id,
                                type: "source",
                                x: 92,
                                y: 42,
                                width: 16,
                                height: 16,
                              },
                            ],
                            target: [],
                          },
                          selected: false,
                          dragging: false,
                          resizing: false,
                          initialized: true,
                          isParent: false,
                          position: {
                            x: Number(posArr[0] ?? 0),
                            y: Number(posArr[1] ?? 0),
                          },
                          data: {
                            id,
                            name,
                            subtitle: "",
                            type,
                            typeVersion,
                            disabled,
                            parameters,
                            inputs,
                            outputs,
                            connections: { inputs: {}, outputs: {} },
                            issues: { items: [], visible: false },
                            pinnedData: { count: 0, visible: false },
                            execution: { status: "unknown", running: false },
                            render: {
                              type: "default",
                              options: {
                                trigger: isTrigger,
                                configuration: false,
                                configurable: true,
                                inputs: { labelSize: "small" },
                                outputs: { labelSize: "small" },
                              },
                            },
                            ...(webhookId ? { webhookId } : {}),
                          },
                          events: {},
                          label: name,
                        } as Record<string, unknown>;
                      });

                      const vueFlowEdges: Array<Record<string, unknown>> = [];
                      const connections = (wfObj.connections ?? {}) as Record<
                        string,
                        unknown
                      >;
                      for (const sourceName of Object.keys(connections)) {
                        const sourceConnections = connections[sourceName] as
                          | Record<
                              string,
                              Array<Array<Record<string, unknown>>>
                            >
                          | undefined;
                        if (!sourceConnections) continue;
                        for (const outputType of Object.keys(
                          sourceConnections
                        )) {
                          const arr = sourceConnections[outputType];
                          if (!Array.isArray(arr)) continue;
                          arr.forEach((connectionArray, arrayIndex) => {
                            if (!Array.isArray(connectionArray)) return;
                            connectionArray.forEach((connection) => {
                              const src = wfObj.nodes?.find(
                                (n) => String(n["name"]) === sourceName
                              );
                              const tgtName = String(connection["node"] ?? "");
                              const tgt = wfObj.nodes?.find(
                                (n) => String(n["name"]) === tgtName
                              );
                              if (src && tgt) {
                                const srcId = String(
                                  (src as Record<string, unknown>)["id"] ?? ""
                                );
                                const tgtId = String(
                                  (tgt as Record<string, unknown>)["id"] ?? ""
                                );
                                const connType = String(
                                  (connection as Record<string, unknown>)[
                                    "type"
                                  ] ?? "main"
                                );
                                const connIndex = Number(
                                  (connection as Record<string, unknown>)[
                                    "index"
                                  ] ?? 0
                                );
                                vueFlowEdges.push({
                                  id: `${srcId}-${tgtId}-${Date.now()}`,
                                  source: srcId,
                                  target: tgtId,
                                  sourceHandle: `outputs/${outputType}/${arrayIndex}`,
                                  targetHandle: `inputs/${connType}/${connIndex}`,
                                });
                              }
                            });
                          });
                        }
                      }

                      flow.nodes.value.splice(
                        0,
                        flow.nodes.value.length,
                        ...vueFlowNodes
                      );
                      flow.edges.value.splice(
                        0,
                        flow.edges.value.length,
                        ...vueFlowEdges
                      );
                    }

                    // eslint-disable-next-line no-console
                    console.log("Workflow written successfully");
                    return true;
                  }
                }
                return false;
              } catch (e) {
                // eslint-disable-next-line no-console
                console.error("Error writing workflow:", e);
                return false;
              }
            }

            const ok = applyWorkflow(workflow);
            return ok
              ? { success: true, message: "Workflow written successfully" }
              : { success: false, message: "Failed to write workflow" };
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            return { success: false, message: msg };
          }
        },
        args: [workflowJsonString],
      });

      const scriptResult = result?.[0]?.result as
        | { success: boolean; message: string }
        | undefined;
      if (!scriptResult?.success) {
        throw new Error(scriptResult?.message || "Script execution failed");
      }
      return true;
    } catch (err) {
      console.error("Write workflow error:", err);
      return false;
    }
  };

  // Removed duplicate overwriteCurrentWorkflow definition

  // const pasteContent = async ({
  //   content,
  // }: {
  //   content: string;
  // }): Promise<boolean> => {
  //   try {
  //     const [tab] = await browser.tabs.query({
  //       active: true,
  //       currentWindow: true,
  //     });

  //     const tabId = typeof tab?.id === "number" ? tab.id : null;
  //     const tabUrl = typeof tab?.url === "string" ? tab.url : "";

  //     if (tabId === null || tabUrl.length === 0) {
  //       throw new Error("No active tab found");
  //     }

  //     // Check if current tab is an n8n instance
  //     if (!isN8nInstance(tabUrl)) {
  //       throw new Error(
  //         "Current tab is not an n8n instance. Please navigate to an n8n workflow page."
  //       );
  //     }

  //     const url = new URL(tabUrl);

  //     try {
  //       // Check if we already have permissions
  //       const hostPermissions = createN8nHostPermissions(url.hostname);

  //       const hasPermission = await browser.permissions.contains({
  //         origins: hostPermissions,
  //       });

  //       if (!hasPermission) {
  //         try {
  //           const granted = await browser.permissions.request({
  //             origins: hostPermissions,
  //           });

  //           if (!granted) {
  //             console.warn("Permission denied, continuing anyway");
  //           }
  //         } catch (permError) {
  //           console.warn(
  //             "Permission request failed (user gesture required):",
  //             permError
  //           );
  //           // Continue anyway, the extension might still work
  //         }
  //       }
  //     } catch (permError) {
  //       console.warn("Permission check failed:", permError);
  //       // Continue anyway, might still work
  //     }

  //     const result = await browser.scripting.executeScript({
  //       target: { tabId },
  //       world: "MAIN",
  //       func: async (content: string, canvasSelectors: string[]) => {
  //         try {
  //           // Find the best n8n canvas element
  //           let targetEl: Element | null = null;
  //           for (const selector of canvasSelectors) {
  //             const found = document.querySelector(selector);
  //             if (found) {
  //               targetEl = found;
  //               break;
  //             }
  //           }

  //           // Fallback to active element or body
  //           if (targetEl === null) {
  //             targetEl = document.activeElement ?? document.body;
  //           }

  //           if (targetEl) {
  //             // Focus the window and target element first
  //             window.focus();
  //             document.body.focus();
  //             (targetEl as HTMLElement).focus();

  //             // Try to write to clipboard with fallback
  //             let clipboardSuccess = false;
  //             try {
  //               await navigator.clipboard.writeText(content);
  //               clipboardSuccess = true;
  //             } catch (clipError) {
  //               console.warn(
  //                 "Clipboard write failed, trying alternative method:",
  //                 clipError
  //               );

  //               // Try using document.execCommand as fallback
  //               try {
  //                 const textArea = document.createElement("textarea");
  //                 textArea.value = content;
  //                 textArea.style.position = "fixed";
  //                 textArea.style.left = "-9999px";
  //                 document.body.appendChild(textArea);
  //                 textArea.focus();
  //                 textArea.select();
  //                 document.execCommand("copy");
  //                 document.body.removeChild(textArea);
  //                 clipboardSuccess = true;
  //               } catch (fallbackError) {
  //                 console.error(
  //                   "Fallback clipboard write also failed:",
  //                   fallbackError
  //                 );
  //                 throw new Error(
  //                   `Failed to write to clipboard: ${
  //                     clipError instanceof Error
  //                       ? clipError.message
  //                       : "Unknown error"
  //                   }`
  //                 );
  //               }
  //             }

  //             if (!clipboardSuccess) {
  //               throw new Error("Failed to write content to clipboard");
  //             }

  //             // Create and dispatch paste event
  //             const createPasteEvent = () =>
  //               new ClipboardEvent("paste", {
  //                 bubbles: true,
  //                 cancelable: true,
  //                 clipboardData: (() => {
  //                   const dt = new DataTransfer();
  //                   dt.setData("text/plain", content);
  //                   return dt;
  //                 })(),
  //               });

  //             const pasteEvent = createPasteEvent();
  //             const dispatched = document.dispatchEvent(pasteEvent);

  //             if (!dispatched) {
  //               console.warn(
  //                 "Paste event was cancelled, but clipboard write succeeded"
  //               );
  //               // Don't throw error here, clipboard write is more important
  //             }

  //             return { success: true, message: "Workflow pasted successfully" };
  //           } else {
  //             throw new Error(
  //               "Could not find suitable target element for pasting"
  //             );
  //           }
  //         } catch (error) {
  //           return {
  //             success: false,
  //             message:
  //               error instanceof Error
  //                 ? error.message
  //                 : "Unknown error during paste",
  //           };
  //         }
  //       },
  //       args: [content, getN8nCanvasSelectors()],
  //     });

  //     const scriptResult = result[0]?.result as
  //       | { success: boolean; message: string }
  //       | undefined;

  //     if (!scriptResult?.success) {
  //       throw new Error(scriptResult?.message || "Script execution failed");
  //     }

  //     return true;
  //   } catch (error) {
  //     console.error("Paste content error:", error);
  //     throw error;
  //   }
  // };

  return (
    <div className="size-full min-h-screen bg-gradient-to-br from-background via-background to-background/95 text-foreground">
      <div className="mx-auto size-full max-w-3xl">
        {!session ? (
          <AuthPanel />
        ) : (
          <div className="flex h-[calc(100vh)] flex-col overflow-hidden bg-background/50 backdrop-blur-sm border border-border/50 shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-card/30 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                  <img
                    src={logo}
                    className="text-xs font-bold text-primary-foreground"
                  />
                </div>
                <span className="text-sm font-semibold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                  N8N GPT
                </span>
              </div>
              <div className=" flex items-center gap-1">
                <Badge
                  variant="secondary"
                  className="font-normal text-primary border-primary border-1 transition-colors duration-200"
                >
                  {generations}/100 Gens
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger className="cursor-pointer">
                    <Avatar>
                      {session?.user?.image && (
                        <AvatarImage src={session?.user?.image} />
                      )}
                      <AvatarFallback>
                        {session?.user?.name?.slice(0, 2) || "ME"}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel
                      className="cursor-pointer"
                      onClick={signOut}
                    >
                      Sign out
                    </DropdownMenuLabel>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <Conversation className="h-full">
              <ConversationContent className="pb-24">
                {messages.map((message, messageIndex) => {
                  const parts = Array.isArray(
                    (message as { parts?: unknown[] }).parts
                  )
                    ? (message as { parts: Array<unknown> }).parts
                    : [];
                  const sourceUrls = parts
                    .filter(isSourceUrlPart)
                    .map((p) => p.url);
                  const sourceCount = sourceUrls.length;
                  const isLastMessage = messageIndex === messages.length - 1;
                  const hasReasoningPart = parts.some(isReasoningPart);
                  const hasTextContent = parts.some(isTextPart);
                  const showBrainstorming =
                    isLastMessage &&
                    hasReasoningPart &&
                    status === "streaming" &&
                    !hasTextContent;

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
                      {hasTextContent && (
                        <Message
                          from={message.role}
                          className="[&>div]:max-w-[88%] sm:[&>div]:max-w-[75%] [&>div]:min-w-0 [&>div]:overflow-hidden"
                        >
                          <MessageContent>
                            {parts.map((part, i) => {
                              if (isTextPart(part)) {
                                return (
                                  <Response
                                    key={`${message.id}-${i}`}
                                    className={cn(
                                      "prose text-primary-foreground",
                                      {
                                        "prose-invert text-secondary-foreground":
                                          message.role === "user",
                                      }
                                    )}
                                  >
                                    {part.text}
                                  </Response>
                                );
                              }
                              return null;
                            })}
                          </MessageContent>
                        </Message>
                      )}
                      {showBrainstorming && (
                        <div className="ml-4 mt-2 mb-4 animate-in fade-in duration-300">
                          <div className="flex items-center gap-3 w-fit px-4 py-2 rounded-xl bg-muted/20 border border-border/30">
                            <Loader />
                            <span className="text-sm font-medium text-muted-foreground">
                              <ShinyText text="Brainstorming.." speed={3} />
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!isOnN8n && (
                  <div className="mx-4 mb-2 rounded-xl bg-gradient-to-r from-muted/40 to-muted/20 border border-border/30 p-4 text-sm text-muted-foreground animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-yellow-500/60 rounded-full animate-pulse"></div>
                      <span className="font-medium">n8n Required</span>
                    </div>
                    <p className="text-xs leading-relaxed">
                      This extension works only on n8n pages. Navigate to an n8n
                      workflow tab to start creating automations.
                    </p>
                  </div>
                )}

                {/* Generation Error Display */}
                {generationError && (
                  <div className="mx-4 mb-2 rounded-xl bg-gradient-to-r from-destructive/20 to-destructive/10 border border-destructive/30 p-4 text-sm animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-destructive rounded-full"></div>
                      <span className="font-medium text-destructive">
                        Generation Limit Reached
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-destructive/90 mb-3">
                      {generationError}
                    </p>
                    <button
                      onClick={() => setGenerationError(null)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 transition-colors duration-200"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                {backendError && (
                  <div className="mx-4 mb-2 rounded-xl bg-gradient-to-r from-destructive/20 to-destructive/10 border border-destructive/30 p-4 text-sm animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-destructive rounded-full"></div>
                      <span className="font-medium text-destructive">
                        Something went wrong
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-destructive/90 mb-3">
                      {backendError}
                    </p>
                    <button
                      onClick={() => setBackendError(null)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 transition-colors duration-200"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                {(status === "submitted" || status !== "ready") &&
                  !generationError && (
                    <div className="ml-4 mt-2 mb-4 animate-in fade-in duration-300">
                      <div className="flex items-center gap-3 w-fit px-4 py-2 rounded-xl bg-muted/20 border border-border/30">
                        {" "}
                        <Loader />
                        <span className="text-sm font-medium text-muted-foreground">
                          {isToolCalling
                            ? "Implementing the changes"
                            : "Thinking..."}
                        </span>
                      </div>
                    </div>
                  )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
            <div className="sticky bottom-0 z-10 border-t border-border/30 bg-card/80 px-4 pb-4 pt-2 backdrop-blur-sm supports-[backdrop-filter]:bg-card/60">
              <PromptInput
                onSubmit={handleSubmit}
                className="mt-2 border-border/50 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-200 rounded-xl"
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
                    disabled={
                      input.trim().length === 0 && status !== "streaming"
                    }
                    status={status}
                    stop={stop}
                  />
                </PromptInputToolbar>
              </PromptInput>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
