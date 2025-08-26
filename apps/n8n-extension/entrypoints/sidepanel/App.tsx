"use client";

import React, { useState } from "react";
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
  const [isPasting, setIsPasting] = useState<boolean>(false);
  const [pendingPaste, setPendingPaste] = useState<{
    json: string;
    toolCallId: string;
  } | null>(null);

  // AI chat hook (expects a backend handler; UI will still render without one)
  const { messages, sendMessage, status, addToolResult } = useChat({
    transport: new DefaultChatTransport({
      api: import.meta.env.VITE_BACKEND_API ?? "http://localhost:5000",
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName === "paste_json_in_n8n") {
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

          // Ask user to confirm via UI buttons
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
  });

  const handleConfirmPaste = async (): Promise<void> => {
    if (!pendingPaste) return;
    setIsPasting(true);
    try {
      const success = await pasteContent({ content: pendingPaste.json });
      addToolResult({
        tool: "paste_json_in_n8n",
        toolCallId: pendingPaste.toolCallId,
        output: success
          ? `Workflow successfully pasted into n8n canvas`
          : `Failed to paste workflow - please make sure you're on an n8n page`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      addToolResult({
        tool: "paste_json_in_n8n",
        toolCallId: pendingPaste.toolCallId,
        output: `Error pasting workflow: ${errorMessage}`,
      });
    } finally {
      setIsPasting(false);
      setPendingPaste(null);
    }
  };

  const handleCancelPaste = (): void => {
    if (!pendingPaste) return;
    addToolResult({
      tool: "paste_json_in_n8n",
      toolCallId: pendingPaste.toolCallId,
      output: `Paste cancelled by user`,
    });
    setPendingPaste(null);
  };

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
              {(status === "submitted" || isPasting) && (
                <div className="flex justify-center py-2 text-muted-foreground">
                  <Loader />
                  {isPasting && (
                    <span className="ml-2 text-sm">
                      Pasting workflow to n8n...
                    </span>
                  )}
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {pendingPaste && (
            <div className="sticky bottom-0 z-20 bg-card/95 border-t px-4 py-3 flex items-center gap-3">
              <div className="text-sm flex-1">
                Paste generated workflow JSON into n8n?
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleConfirmPaste}
                >
                  Yes, paste
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelPaste}>
                  No
                </Button>
              </div>
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
}
