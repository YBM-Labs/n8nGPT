// Message part type guards
export type SourceUrlPart = { type: "source-url"; url: string };
export type TextPart = { type: "text"; text: string };
export type ReasoningPart = { type: "reasoning"; text: string };

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isSourceUrlPart = (part: unknown): part is SourceUrlPart =>
  isRecord(part) && part.type === "source-url" && typeof part.url === "string";

export const isTextPart = (part: unknown): part is TextPart =>
  isRecord(part) && part.type === "text" && typeof part.text === "string";

export const isReasoningPart = (part: unknown): part is ReasoningPart =>
  isRecord(part) && part.type === "reasoning" && typeof part.text === "string";

// N8n Node Types
export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  disabled: boolean;
  parameters: Record<string, unknown>;
  webhookId?: string;
}

export interface ErrorNode extends N8nNode {
  issues: Array<string>;
}

export interface UnavailableNode {
  id: string;
  name: string;
  type: string;
  position: [number, number];
}

export interface NodeConnection {
  fromNodeId: string;
  fromNodeName: string;
  outputType: string;
  arrayIndex: number;
  type: string;
  index: number;
}

export interface NodeInfo {
  node: N8nNode;
  inbound: Array<NodeConnection>;
  outbound: Array<{
    toNodeId: string;
    toNodeName: string;
    outputType: string;
    arrayIndex: number;
    type: string;
    index: number;
  }>;
}

// Tool Call Types
export interface ConnectNodesInput {
  from: {
    nodeId: string;
    outputType?: string;
    arrayIndex?: number;
  };
  to: {
    nodeId: string;
    inputType?: string;
    index?: number;
  };
}

export interface ModifyWorkflowInput {
  modifications: unknown;
}

export interface AddNodeInput {
  nodeType: string;
  nodeName: string;
  parameters: Record<string, unknown>;
  position: [number, number];
}

// API Models Configuration
export interface ModelConfig {
  name: string;
  value: string;
}

// App State Types
export interface AppError {
  type: "generation" | "backend";
  message: string;
}

// Tool Handling Types

/**
 * Identifies a single tool call emitted by the model/runtime.
 */
export interface ToolCall {
  toolName: string;
  toolCallId: string;
  input?: unknown;
}

/**
 * Convenience type for tool calls that may carry an input payload.
 */
export type ToolCallWithInput = ToolCall & { input?: unknown };

/**
 * Standardized structure for reporting tool results back to the caller/UI.
 */
export interface ToolResult {
  tool: string;
  toolCallId: string;
  output: string;
}

/**
 * Functions that perform concrete n8n operations used by tool handlers.
 */
export interface ToolOperations {
  getErrorNodes: () => Promise<Array<ErrorNode>>;
  getUnavailableNodes: () => Promise<Array<UnavailableNode>>;
  fetchCurrentWorkflow: () => Promise<string | null>;
  addNode: (input: AddNodeInput) => Promise<string | false>;
  deleteCurrentWorkflow: () => Promise<boolean>;
  writeWorkflowFromJson: (workflowJsonString: string) => Promise<boolean>;
  getNodeInfoById: (nodeId: string) => Promise<NodeInfo | null>;
  deleteNode: (nodeId: string) => Promise<boolean>;
  connectNodes: (input: ConnectNodesInput) => Promise<boolean>;
  applyWorkflowModifications: (modifications: unknown) => Promise<boolean>;
}

/**
 * Function signature for handling an individual tool call.
 */
export type ToolCallHandler = (args: { toolCall: ToolCall }) => Promise<void>;

/**
 * Factory that creates a typed tool call handler bound to provided operations
 * and a reporting function.
 */
export type CreateToolCallHandler = (
  operations: ToolOperations,
  addToolResult: (result: ToolResult) => void
) => ToolCallHandler;
