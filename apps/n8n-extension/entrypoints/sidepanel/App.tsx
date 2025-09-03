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
import { authClient } from "@/lib/auth-client";
import AuthPanel from "@/components/auth/authComponent";

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
  const { data: session, isPending } = authClient.useSession();

  const MODELS: ReadonlyArray<{ name: string; value: string }> = [
    {
      name: "Claude Sonnet 4",
      value: "anthropic/claude-sonnet-4",
    },
    { name: "Gemini 2.0 Flash", value: "google/gemini-2.0-flash-001" },
    { name: "Deepseek R1", value: "deepseek/deepseek-r1" },
    { name: "Grok Code Fast 1", value: "x-ai/grok-code-fast-1" },
  ];

  // Local chat UI state
  const [input, setInput] = useState<string>("");
  const [model, setModel] = useState<string>(
    MODELS[0]?.value ?? "openai/gpt-4o"
  );
  const [webSearch, setWebSearch] = useState<boolean>(false);
  const [isPasting, setIsPasting] = useState<boolean>(false);
  const [generations, setGenerations] = useState<number>(0);
  const [pendingPaste, setPendingPaste] = useState<{
    json: string;
    toolCallId?: string;
  } | null>(null);
  const [isOnN8n, setIsOnN8n] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const lastAutoPromptedMessageId = useRef<string | null>(null);

  const signOut = async () => {
    const { error } = await authClient.signOut();
    if (error) {
      console.error(error);
    }
  };
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

  // Clear any pending paste when leaving n8n
  useEffect(() => {
    if (!isOnN8n && pendingPaste) setPendingPaste(null);
  }, [isOnN8n, pendingPaste]);

  // AI chat hook (expects a backend handler; UI will still render without one)
  const { messages, sendMessage, status, addToolResult, error, stop } = useChat(
    {
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
              setGenerationError(
                "You have reached your monthly limit. Please try again next month."
              );
            }
          } catch {
            setGenerationError(
              "You have reached your monthly limit. Please try again next month."
            );
          }
        } else {
          setGenerationError(
            "An error occurred while processing your request. Please try again."
          );
        }
      },
      onToolCall: async ({ toolCall }) => {
        if (toolCall.toolName === "paste_json_in_n8n") {
          if (!isOnN8n) {
            addToolResult({
              tool: "paste_json_in_n8n",
              toolCallId: toolCall.toolCallId,
              output: `Not on an n8n tab. Open an n8n workflow page to paste.`,
            });
            return;
          }
          try {
            let content: string;
            if (
              typeof toolCall.input === "object" &&
              toolCall.input &&
              "json" in toolCall.input
            ) {
              content = (toolCall.input as { json: string }).json;
            } else if (typeof toolCall.input === "string") {
              content = toolCall.input;
            } else {
              throw new Error("Invalid tool call input format");
            }
            setPendingPaste({ json: content, toolCallId: toolCall.toolCallId });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "paste_json_in_n8n",
              toolCallId: toolCall.toolCallId,
              output: `Error preparing paste: ${errorMessage}`,
            });
          }
        }
      },
    }
  );

  // When assistant finishes a response, try to extract JSON from it and prompt immediately
  useEffect(() => {
    if (!isOnN8n) return;
    if (status === "streaming" || pendingPaste !== null) return;
    if (messages.length === 0) return;
    const last = messages[messages.length - 1] as unknown as {
      role?: string;
      id: string;
      parts?: unknown[];
    };
    if (last?.role !== "assistant") return;
    if (lastAutoPromptedMessageId.current === last.id) return;
    const parts = Array.isArray(last.parts) ? (last.parts as unknown[]) : [];
    const text = parts
      .filter(isTextPart)
      .map((p: unknown) => (p as TextPart).text)
      .join("\n");
    if (!text) return;
    const json = extractJsonFromText(text);
    if (json) {
      setPendingPaste({ json });
      lastAutoPromptedMessageId.current = last.id;
    }
  }, [messages, status, pendingPaste, isOnN8n]);

  useEffect(() => {
    const getGenerations = async () => {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/generations`
      );
      const data = await response.json();
      setGenerations(data.generations);
    };
    getGenerations();
  }, [session, messages]);

  const handleConfirmPaste = async (): Promise<void> => {
    if (!pendingPaste || !isOnN8n) return;
    setIsPasting(true);
    try {
      const success = await pasteContent({ content: pendingPaste.json });
      if (pendingPaste.toolCallId) {
        addToolResult({
          tool: "paste_json_in_n8n",
          toolCallId: pendingPaste.toolCallId,
          output: success
            ? `Workflow successfully pasted into n8n canvas`
            : `Failed to paste workflow - please make sure you're on an n8n page`,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      if (pendingPaste.toolCallId) {
        addToolResult({
          tool: "paste_json_in_n8n",
          toolCallId: pendingPaste.toolCallId,
          output: `Error pasting workflow: ${errorMessage}`,
        });
      }
    } finally {
      setIsPasting(false);
      setPendingPaste(null);
    }
  };

  const handleCancelPaste = (): void => {
    if (!pendingPaste) return;
    if (pendingPaste.toolCallId) {
      addToolResult({
        tool: "paste_json_in_n8n",
        toolCallId: pendingPaste.toolCallId,
        output: `Paste cancelled by user`,
      });
    }
    setPendingPaste(null);
  };

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

  const pasteContent = async ({
    content,
  }: {
    content: string;
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

      // Check if current tab is an n8n instance
      if (!isN8nInstance(tabUrl)) {
        throw new Error(
          "Current tab is not an n8n instance. Please navigate to an n8n workflow page."
        );
      }

      const url = new URL(tabUrl);

      try {
        // Check if we already have permissions
        const hostPermissions = createN8nHostPermissions(url.hostname);

        const hasPermission = await browser.permissions.contains({
          origins: hostPermissions,
        });

        if (!hasPermission) {
          try {
            const granted = await browser.permissions.request({
              origins: hostPermissions,
            });

            if (!granted) {
              console.warn("Permission denied, continuing anyway");
            }
          } catch (permError) {
            console.warn(
              "Permission request failed (user gesture required):",
              permError
            );
            // Continue anyway, the extension might still work
          }
        }
      } catch (permError) {
        console.warn("Permission check failed:", permError);
        // Continue anyway, might still work
      }

      const result = await browser.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: async (content: string, canvasSelectors: string[]) => {
          try {
            // Find the best n8n canvas element
            let targetEl: Element | null = null;
            for (const selector of canvasSelectors) {
              const found = document.querySelector(selector);
              if (found) {
                targetEl = found;
                break;
              }
            }

            // Fallback to active element or body
            if (targetEl === null) {
              targetEl = document.activeElement ?? document.body;
            }

            if (targetEl) {
              // Focus the window and target element first
              window.focus();
              document.body.focus();
              (targetEl as HTMLElement).focus();

              // Try to write to clipboard with fallback
              let clipboardSuccess = false;
              try {
                await navigator.clipboard.writeText(content);
                clipboardSuccess = true;
              } catch (clipError) {
                console.warn(
                  "Clipboard write failed, trying alternative method:",
                  clipError
                );

                // Try using document.execCommand as fallback
                try {
                  const textArea = document.createElement("textarea");
                  textArea.value = content;
                  textArea.style.position = "fixed";
                  textArea.style.left = "-9999px";
                  document.body.appendChild(textArea);
                  textArea.focus();
                  textArea.select();
                  document.execCommand("copy");
                  document.body.removeChild(textArea);
                  clipboardSuccess = true;
                } catch (fallbackError) {
                  console.error(
                    "Fallback clipboard write also failed:",
                    fallbackError
                  );
                  throw new Error(
                    `Failed to write to clipboard: ${clipError instanceof Error ? clipError.message : "Unknown error"}`
                  );
                }
              }

              if (!clipboardSuccess) {
                throw new Error("Failed to write content to clipboard");
              }

              // Create and dispatch paste event
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

              const pasteEvent = createPasteEvent();
              const dispatched = document.dispatchEvent(pasteEvent);

              if (!dispatched) {
                console.warn(
                  "Paste event was cancelled, but clipboard write succeeded"
                );
                // Don't throw error here, clipboard write is more important
              }

              return { success: true, message: "Workflow pasted successfully" };
            } else {
              throw new Error(
                "Could not find suitable target element for pasting"
              );
            }
          } catch (error) {
            return {
              success: false,
              message:
                error instanceof Error
                  ? error.message
                  : "Unknown error during paste",
            };
          }
        },
        args: [content, getN8nCanvasSelectors()],
      });

      const scriptResult = result[0]?.result as
        | { success: boolean; message: string }
        | undefined;

      if (!scriptResult?.success) {
        throw new Error(scriptResult?.message || "Script execution failed");
      }

      return true;
    } catch (error) {
      console.error("Paste content error:", error);
      throw error;
    }
  };

  return (
    <div className="size-full min-h-screen bg-gradient-to-br from-background via-background to-background/95 text-foreground">
      <div className="mx-auto size-full max-w-3xl">
        {!session ? (
          <AuthPanel />
        ) : (
          <div className="flex h-[calc(100vh)] flex-col overflow-hidden bg-background/50 backdrop-blur-sm border border-border/50 shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-card/30 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-gradient-to-br from-primary to-primary/80 rounded-md flex items-center justify-center">
                  <span className="text-xs font-bold text-primary-foreground">
                    n8n
                  </span>
                </div>
                <span className="text-sm font-semibold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                  n8n GPT Assistant
                </span>
              </div>
              <Badge
                variant="secondary"
                className="font-normal bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors duration-200"
              >
                {generations}/100 Requests
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
                                  <ReasoningContent>
                                    {part.text}
                                  </ReasoningContent>
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
                {(status === "submitted" || isPasting) && !generationError && (
                  <div className="flex justify-center py-4 text-muted-foreground animate-in fade-in duration-300">
                    <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-muted/20 border border-border/30">
                      <Loader />
                      {isPasting ? (
                        <span className="text-sm font-medium">
                          ✨ Pasting workflow to n8n...
                        </span>
                      ) : (
                        <span className="text-sm font-medium">Thinking...</span>
                      )}
                    </div>
                  </div>
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            {pendingPaste && (
              <div className="sticky bottom-0 z-20 bg-card/95 backdrop-blur-sm border-t border-border/30 px-4 py-3 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm font-medium">
                      Paste workflow into n8n?
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={handleConfirmPaste}
                      className=" transition-transform duration-200 bg-primary hover:bg-primary/90"
                    >
                      Yes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelPaste}
                      className=" transition-transform duration-200 border-border/50 hover:border-border"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

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
              {session && (
                <div className="text-sm text-muted-foreground flex justify-center items-center m-2">
                  <button
                    className="text-xs rounded-lg border border-border/50 px-3 py-1.5 cursor-pointer
                      hover:border-primary/50 hover:bg-primary/5 hover:text-primary
                      transition-all duration-200 ease-in-out
                      hover:scale-105 active:scale-95"
                    onClick={signOut}
                  >
                    👋 Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
