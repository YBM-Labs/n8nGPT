import { logger } from "./logger";
import type {
  CreateToolCallHandler,
  ToolCallWithInput,
  ToolOperations,
  ToolResult,
  ConnectNodesInput,
  AddNodeInput,
} from "./types";
import { isRecord } from "./types";

/**
 * Create a tool call handler bound to provided n8n operations.
 */
export const createToolCallHandler: CreateToolCallHandler = (
  operations: ToolOperations,
  addToolResult: (result: ToolResult) => void
) => {
  return async ({
    toolCall,
  }: {
    toolCall: ToolCallWithInput;
  }): Promise<void> => {
    logger.info(`Handling tool call: ${toolCall.toolName}`);

    try {
      switch (toolCall.toolName) {
        case "write_workflow":
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

            const applied =
              await operations.writeWorkflowFromJson(workflowJsonString);
            if (applied) {
              const [json, unavailable] = await Promise.all([
                operations.fetchCurrentWorkflow(),
                operations.getUnavailableNodes(),
              ]);
              addToolResult({
                tool: "write_workflow",
                toolCallId: toolCall.toolCallId,
                output:
                  "Workflow written successfully. New workflow: " +
                  json +
                  "\\nUnavailable nodes: " +
                  JSON.stringify(unavailable),
              });
              logger.toolCall("write_workflow", true);
            } else {
              addToolResult({
                tool: "write_workflow",
                toolCallId: toolCall.toolCallId,
                output: "Failed to write workflow",
              });
              logger.toolCall("write_workflow", false);
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "write_workflow",
              toolCallId: toolCall.toolCallId,
              output: `Failed to write workflow: ${message}`,
            });
            logger.toolCall(
              "write_workflow",
              false,
              error instanceof Error ? error : undefined
            );
          }
          break;

        case "get_current_workflow":
          try {
            const json = await operations.fetchCurrentWorkflow();
            if (typeof json === "string" && json.length > 0) {
              addToolResult({
                tool: "get_current_workflow",
                toolCallId: toolCall.toolCallId,
                output: json,
              });
              logger.toolCall("get_current_workflow", true);
            } else {
              addToolResult({
                tool: "get_current_workflow",
                toolCallId: toolCall.toolCallId,
                output: "No workflow found",
              });
              logger.toolCall("get_current_workflow", false);
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "get_current_workflow",
              toolCallId: toolCall.toolCallId,
              output: `Failed to retrieve workflow: ${message}`,
            });
            logger.toolCall(
              "get_current_workflow",
              false,
              error instanceof Error ? error : undefined
            );
          }
          break;

        case "delete_workflow":
          try {
            const applied = await operations.deleteCurrentWorkflow();
            if (applied) {
              const json = await operations.fetchCurrentWorkflow();
              addToolResult({
                tool: "delete_workflow",
                toolCallId: toolCall.toolCallId,
                output: `Workflow deleted/cleared successfully. Canvas: ${json}`,
              });
              logger.toolCall("delete_workflow", true);
            } else {
              addToolResult({
                tool: "delete_workflow",
                toolCallId: toolCall.toolCallId,
                output: "Failed to delete workflow",
              });
              logger.toolCall("delete_workflow", false);
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "delete_workflow",
              toolCallId: toolCall.toolCallId,
              output: `Failed to delete workflow: ${message}`,
            });
            logger.toolCall(
              "delete_workflow",
              false,
              error instanceof Error ? error : undefined
            );
          }
          break;

        case "add_node":
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

            const addedId = await operations.addNode({
              nodeType,
              nodeName,
              parameters,
              position,
            } as AddNodeInput);

            if (typeof addedId === "string" && addedId.length > 0) {
              const [json, unavailable] = await Promise.all([
                operations.fetchCurrentWorkflow(),
                operations.getUnavailableNodes(),
              ]);
              addToolResult({
                tool: "add_node",
                toolCallId: toolCall.toolCallId,
                output:
                  `Node added successfully with id ${addedId}` +
                  "\\nUnavailable nodes: " +
                  JSON.stringify(unavailable),
              });
              logger.toolCall("add_node", true);
            } else {
              addToolResult({
                tool: "add_node",
                toolCallId: toolCall.toolCallId,
                output: "Failed to add node",
              });
              logger.toolCall("add_node", false);
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "add_node",
              toolCallId: toolCall.toolCallId,
              output: `Failed to add node: ${message}`,
            });
            logger.toolCall(
              "add_node",
              false,
              error instanceof Error ? error : undefined
            );
          }
          break;

        case "delete_node":
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
            const ok = await operations.deleteNode(nodeId);
            if (ok) {
              const json = await operations.fetchCurrentWorkflow();
              addToolResult({
                tool: "delete_node",
                toolCallId: toolCall.toolCallId,
                output: `Node ${nodeId} deleted successfully`,
              });
              logger.toolCall("delete_node", true);
            } else {
              addToolResult({
                tool: "delete_node",
                toolCallId: toolCall.toolCallId,
                output: "Failed to delete node",
              });
              logger.toolCall("delete_node", false);
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "delete_node",
              toolCallId: toolCall.toolCallId,
              output: `Failed to delete node: ${message}`,
            });
            logger.toolCall(
              "delete_node",
              false,
              error instanceof Error ? error : undefined
            );
          }
          break;

        case "get_node_info":
          try {
            let nodeId = "";
            if (
              typeof toolCall.input === "object" &&
              toolCall.input !== null &&
              typeof (toolCall.input as Record<string, unknown>)["nodeId"] ===
                "string"
            ) {
              nodeId = String(
                (toolCall.input as Record<string, unknown>)["nodeId"]
              );
            } else if (typeof toolCall.input === "string") {
              nodeId = toolCall.input;
            } else {
              throw new Error(
                "Invalid input for get_node_info; expected { nodeId: string } or a string"
              );
            }

            const info = await operations.getNodeInfoById(nodeId);
            if (info) {
              addToolResult({
                tool: "get_node_info",
                toolCallId: toolCall.toolCallId,
                output: JSON.stringify(info),
              });
              logger.toolCall("get_node_info", true);
            } else {
              addToolResult({
                tool: "get_node_info",
                toolCallId: toolCall.toolCallId,
                output: `Node ${nodeId} not found`,
              });
              logger.toolCall("get_node_info", false);
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "get_node_info",
              toolCallId: toolCall.toolCallId,
              output: `Failed to get node info: ${message}`,
            });
            logger.toolCall(
              "get_node_info",
              false,
              error instanceof Error ? error : undefined
            );
          }
          break;

        case "get_error_nodes":
          try {
            const nodes = await operations.getErrorNodes();
            addToolResult({
              tool: "get_error_nodes",
              toolCallId: toolCall.toolCallId,
              output: JSON.stringify(nodes),
            });
            logger.toolCall("get_error_nodes", true);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "get_error_nodes",
              toolCallId: toolCall.toolCallId,
              output: `Failed to get error nodes: ${message}`,
            });
            logger.toolCall(
              "get_error_nodes",
              false,
              error instanceof Error ? error : undefined
            );
          }
          break;

        case "get_unavailable_nodes":
          try {
            const nodes = await operations.getUnavailableNodes();
            addToolResult({
              tool: "get_unavailable_nodes",
              toolCallId: toolCall.toolCallId,
              output: JSON.stringify(nodes),
            });
            logger.toolCall("get_unavailable_nodes", true);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "get_unavailable_nodes",
              toolCallId: toolCall.toolCallId,
              output: `Failed to get unavailable nodes: ${message}`,
            });
            logger.toolCall(
              "get_unavailable_nodes",
              false,
              error instanceof Error ? error : undefined
            );
          }
          break;

        case "connect_nodes":
          try {
            if (typeof toolCall.input !== "object" || toolCall.input === null) {
              throw new Error(
                "Invalid input for connect_nodes; expected { from: {...}, to: {...} }"
              );
            }
            const rec = toolCall.input as Record<string, unknown>;
            if (!isRecord(rec["from"]) || !isRecord(rec["to"])) {
              throw new Error(
                "Invalid input for connect_nodes; expected { from: {...}, to: {...} }"
              );
            }
            const input = toolCall.input as ConnectNodesInput;
            const from = {
              nodeId: String(input.from?.nodeId ?? ""),
              outputType: input.from?.outputType,
              arrayIndex: input.from?.arrayIndex,
            };
            const to = {
              nodeId: String(input.to?.nodeId ?? ""),
              inputType: input.to?.inputType,
              index: input.to?.index,
            };
            if (!from.nodeId || !to.nodeId) {
              throw new Error("from.nodeId and to.nodeId are required");
            }

            const ok = await operations.connectNodes({ from, to });
            if (ok) {
              const [json, unavailable] = await Promise.all([
                operations.fetchCurrentWorkflow(),
                operations.getUnavailableNodes(),
              ]);
              addToolResult({
                tool: "connect_nodes",
                toolCallId: toolCall.toolCallId,
                output:
                  "Nodes connected successfully. New workflow: " +
                  json +
                  "\\nUnavailable nodes: " +
                  JSON.stringify(unavailable),
              });
              logger.toolCall("connect_nodes", true);
            } else {
              addToolResult({
                tool: "connect_nodes",
                toolCallId: toolCall.toolCallId,
                output: "Failed to connect nodes",
              });
              logger.toolCall("connect_nodes", false);
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "connect_nodes",
              toolCallId: toolCall.toolCallId,
              output: `Failed to connect nodes: ${message}`,
            });
            logger.toolCall(
              "connect_nodes",
              false,
              error instanceof Error ? error : undefined
            );
          }
          break;

        case "modify_workflow":
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

            const applied =
              await operations.applyWorkflowModifications(modifications);
            if (applied) {
              const [json, unavailable] = await Promise.all([
                operations.fetchCurrentWorkflow(),
                operations.getUnavailableNodes(),
              ]);
              addToolResult({
                tool: "modify_workflow",
                toolCallId: toolCall.toolCallId,
                output:
                  "Workflow modified successfully. New workflow: " +
                  json +
                  "\\nUnavailable nodes: " +
                  JSON.stringify(unavailable),
              });
              logger.toolCall("modify_workflow", true);
            } else {
              addToolResult({
                tool: "modify_workflow",
                toolCallId: toolCall.toolCallId,
                output: "Failed to modify workflow",
              });
              logger.toolCall("modify_workflow", false);
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error occurred";
            addToolResult({
              tool: "modify_workflow",
              toolCallId: toolCall.toolCallId,
              output: `Failed to modify workflow: ${message}`,
            });
            logger.toolCall(
              "modify_workflow",
              false,
              error instanceof Error ? error : undefined
            );
          }
          break;

        default:
          logger.warn(`Unknown tool call: ${toolCall.toolName}`);
          addToolResult({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: `Unknown tool: ${toolCall.toolName}`,
          });
      }
    } catch (error) {
      logger.error(
        `Tool call handler error for ${toolCall.toolName}`,
        error instanceof Error ? error : undefined
      );
      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: `Tool call failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  };
};
