"use client";

import React, { useState, useEffect } from "react";
import { browser } from "wxt/browser";
import { useChat } from "@ai-sdk/react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Response } from "@/components/ai-elements/response";
import EmptyState from "@/components/ai-elements/empty-state";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/source";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { authClient } from "@/lib/auth-client";
import AuthPanel from "@/components/auth/authComponent";
import { cn } from "@/lib/utils";

// Custom hooks
import { useN8nOperations } from "@/hooks/useN8nOperations";
import { useN8nDetection } from "@/hooks/useN8nDetection";
import { useAppError } from "@/hooks/useAppError";

// Components
import { AppHeader } from "@/components/app/AppHeader";
import { StatusIndicators } from "@/components/app/StatusIndicators";
import {
  LoadingIndicator,
  BrainstormingIndicator,
} from "@/components/app/LoadingIndicator";

// Types and constants
import { DEFAULT_MODEL } from "@/lib/constants";
import { isSourceUrlPart, isTextPart, isReasoningPart } from "@/lib/types";
import { logger } from "@/lib/logger";
import { createToolCallHandler } from "@/lib/tool-handlers";

export default function App() {
  const [forceSessionRefresh, setForceSessionRefresh] = useState(0);
  const { data: session, isPending } = authClient.useSession();

  // Custom hooks
  const { isOnN8n } = useN8nDetection();
  const n8nOperations = useN8nOperations();
  const {
    generationError,
    backendError,
    handleError,
    clearGenerationError,
    clearBackendError,
    clearAllErrors,
  } = useAppError();

  // Local chat UI state
  const [input, setInput] = useState<string>("");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [webSearch, setWebSearch] = useState<boolean>(false);
  const [generations, setGenerations] = useState<number>(0);
  const [isToolCalling, setIsToolCalling] = useState<boolean>(false);

  const signOut = async () => {
    const { error } = await authClient.signOut();
    if (error) {
      logger.error(
        "Sign out failed",
        error instanceof Error ? error : undefined
      );
    }
  };

  // Listen for OAuth callback from background script
  useEffect(() => {
    const handleOAuthCallback = async (message: any) => {
      if (message.type === "OAUTH_CALLBACK") {
        logger.info("OAuth callback received", { url: message.url });

        await new Promise((resolve) => setTimeout(resolve, 1000));

        try {
          await authClient.getSession();
          logger.info("Session refreshed successfully");
          setForceSessionRefresh((prev) => prev + 1);

          setTimeout(() => {
            window.location.reload();
          }, 500);
        } catch (error) {
          logger.error(
            "Failed to refresh session",
            error instanceof Error ? error : undefined
          );
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

  // AI chat hook with simplified tool handling
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
    onError: handleError,
    onToolCall: async ({ toolCall }) => {
      setIsToolCalling(true);
      try {
        const toolHandler = createToolCallHandler(n8nOperations, addToolResult);
        await toolHandler({ toolCall });
      } finally {
        setIsToolCalling(false);
      }
    },
    experimental_throttle: 50,
  });

  // Get user generations count
  useEffect(() => {
    const getGenerations = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_API}/generations`
        );
        const data = await response.json();
        setGenerations(data.generations);
      } catch (error) {
        logger.error(
          "Failed to fetch generations",
          error instanceof Error ? error : undefined
        );
      }
    };
    getGenerations();
  }, [session, status === "ready"]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!isOnN8n) return;

    const trimmed = input.trim();
    if (trimmed.length === 0) return;

    clearAllErrors();

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
        },
      }
    );

    setInput("");
  };

  return (
    <div className="size-full min-h-screen bg-gradient-to-br from-background via-background to-background/95 text-foreground">
      <div className="mx-auto size-full max-w-3xl">
        {!session ? (
          <div className="flex items-center justify-center px-4 py-8 max-w-md mx-auto w-full">
            <AuthPanel />
          </div>
        ) : (
          <div className="flex h-[calc(100vh)] flex-col overflow-hidden bg-background/50 backdrop-blur-sm border border-border/50 shadow-lg">
            <AppHeader
              generations={generations}
              session={session}
              onSignOut={signOut}
            />

            {messages.length === 0 && status === "ready" && (
              <EmptyState
                onPrompt={(text) => {
                  setInput(text);
                }}
              />
            )}

            <Conversation className="h-full">
              <ConversationContent className="pb-24 h-full">
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
                          <MessageContent variant={"flat"}>
                            {parts.map((part, i) => {
                              if (isTextPart(part)) {
                                return (
                                  <Response
                                    key={`${message.id}-${i}`}
                                    className={cn("prose prose-invert")}
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
                      <BrainstormingIndicator show={showBrainstorming} />
                    </div>
                  );
                })}

                <StatusIndicators
                  isOnN8n={isOnN8n}
                  generationError={generationError}
                  backendError={backendError}
                  onClearGenerationError={clearGenerationError}
                  onClearBackendError={clearBackendError}
                />

                <LoadingIndicator
                  status={status}
                  isToolCalling={isToolCalling}
                  generationError={generationError}
                />
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
                    {/* Model selector removed for simplicity */}
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
