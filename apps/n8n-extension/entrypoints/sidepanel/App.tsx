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
  const CONTENT_TO_PASTE = `{
  "name": "Basic Data Processing Workflow",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "cronExpression": "0 9 * * *"
            }
          ]
        }
      },
      "id": "trigger-node",
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.1,
      "position": [
        240,
        300
      ]
    },
    {
      "parameters": {
        "url": "https://jsonplaceholder.typicode.com/posts",
        "options": {}
      },
      "id": "http-request",
      "name": "Fetch Data",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [
        460,
        300
      ]
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "id": "condition-1",
              "leftValue": "={{ $json.userId }}",
              "rightValue": 1,
              "operator": {
                "type": "number",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "id": "filter-node",
      "name": "Filter User 1 Posts",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [
        680,
        300
      ]
    },
    {
      "parameters": {
        "operation": "append",
        "documentId": {
          "__rl": true,
          "value": "your-google-sheet-id",
          "mode": "id"
        },
        "sheetName": "Sheet1",
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "Title": "={{ $json.title }}",
            "Body": "={{ $json.body }}",
            "Date": "={{ new Date().toISOString().split('T')[0] }}"
          }
        },
        "options": {}
      },
      "id": "google-sheets",
      "name": "Save to Google Sheets",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.1,
      "position": [
        900,
        300
      ]
    }
  ],
  "connections": {
    "Schedule Trigger": {
      "main": [
        [
          {
            "node": "Fetch Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Fetch Data": {
      "main": [
        [
          {
            "node": "Filter User 1 Posts",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Filter User 1 Posts": {
      "main": [
        [
          {
            "node": "Save to Google Sheets",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {},
  "settings": {
    "executionOrder": "v1"
  },
  "staticData": null,
  "tags": [],
  "triggerCount": 0,
  "updatedAt": "2024-01-15T10:00:00.000Z",
  "versionId": "1"
}`;

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
            try {
              const parsed = JSON.parse(content);
              const payload = {
                name:
                  typeof parsed.name === "string" && parsed.name.length > 0
                    ? parsed.name
                    : "Imported Workflow",
                nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
                connections:
                  typeof parsed.connections === "object" &&
                  parsed.connections !== null
                    ? parsed.connections
                    : {},
                pinData:
                  typeof parsed.pinData === "object" && parsed.pinData !== null
                    ? parsed.pinData
                    : {},
                settings:
                  typeof parsed.settings === "object" &&
                  parsed.settings !== null
                    ? parsed.settings
                    : {},
                tags: Array.isArray(parsed.tags) ? parsed.tags : [],
              } as const;

              const paths = ["/rest/workflows", "/api/v1/workflows"] as const;
              for (const p of paths) {
                try {
                  const resp = await fetch(p, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    credentials: "include",
                  });
                  if (resp.ok) {
                    return true;
                  }
                } catch {
                  // continue
                }
              }
            } catch {
              // ignore
            }
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
        </div>
      </div>
    </div>
  );
}
