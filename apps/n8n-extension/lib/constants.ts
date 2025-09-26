import type { ModelConfig } from "./types";

export const MODELS: ReadonlyArray<ModelConfig> = [
  {
    name: "Claude Sonnet 4",
    value: "anthropic/claude-sonnet-4",
  },
  { name: "Gemini 2.0 Flash", value: "google/gemini-2.0-flash-001" },
  { name: "Deepseek R1", value: "deepseek/deepseek-r1" },
  { name: "Grok Code Fast 1", value: "x-ai/grok-code-fast-1" },
  { name: "OpenAI GPT-5", value: "openai/gpt-5" },
  { name: "GLM 4.5", value: "z-ai/glm-4.5:nitro" },
  { name: "GPT-4.1 Mini", value: "openai/gpt-4.1-mini" },
  { name: "Qwen 3 Coder", value: "qwen/qwen3-coder" },
  { name: "Qwen 3 30B A3B", value: "qwen/qwen3-30b-a3b" },
] as const;

export const DEFAULT_MODEL = MODELS[6]?.value ?? "openai/gpt-4o";

export const NODE_TYPE_VERSIONS: Record<string, number> = {
  "n8n-nodes-base.manualTrigger": 1,
  "n8n-nodes-base.httpRequest": 4.2,
  "n8n-nodes-base.set": 3.4,
  "n8n-nodes-base.stickyNote": 1,
  "@n8n/n8n-nodes-langchain.agent": 1.8,
  "@n8n/n8n-nodes-langchain.chatTrigger": 1.1,
};

export const VUE_FLOW_FLOW_KEY = "__EMPTY__";

export const ERROR_MESSAGES = {
  NO_ACTIVE_TAB: "No active tab found",
  NOT_N8N_INSTANCE: "Current tab is not an n8n instance. Please navigate to an n8n workflow page.",
  SCRIPT_EXECUTION_FAILED: "Script execution failed",
  NODE_NOT_FOUND: "Node not found",
  INVALID_INPUT: "Invalid input format",
  VUE_CONTEXT_NOT_FOUND: "Could not access Vue app context",
  WORKFLOW_NOT_FOUND: "No workflow found",
  UNKNOWN_ERROR: "Unknown error occurred",
} as const;