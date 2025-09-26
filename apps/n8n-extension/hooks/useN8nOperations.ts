import { useCallback } from "react";
import { executeN8nScript, BrowserApiError } from "@/lib/browser-utils";
import {
  getErrorNodesScript,
  getUnavailableNodesScript,
  fetchWorkflowScript,
  addNodeScript,
  deleteWorkflowScript,
  writeWorkflowFromJsonScript,
  getNodeInfoByIdScript,
  deleteNodeScript,
  connectNodesScript,
  applyWorkflowModificationsScript,
} from "@/lib/n8n-scripts";
import type {
  ErrorNode,
  UnavailableNode,
  AddNodeInput,
  NodeInfo,
  ConnectNodesInput,
} from "@/lib/types";

export const useN8nOperations = () => {
  /**
   * Get nodes with errors from the current workflow
   */
  const getErrorNodes = useCallback(async (): Promise<ErrorNode[]> => {
    try {
      const result = await executeN8nScript(getErrorNodesScript);
      return result?.success ? result.nodes : [];
    } catch (error) {
      console.error("Get error nodes error:", error);
      return [];
    }
  }, []);

  /**
   * Get unavailable nodes from the current workflow
   */
  const getUnavailableNodes = useCallback(async (): Promise<UnavailableNode[]> => {
    try {
      const result = await executeN8nScript(getUnavailableNodesScript);
      return result?.success ? result.nodes : [];
    } catch (error) {
      console.error("Get unavailable nodes error:", error);
      return [];
    }
  }, []);

  /**
   * Fetch the current workflow as JSON string
   */
  const fetchCurrentWorkflow = useCallback(async (): Promise<string | null> => {
    try {
      const result = await executeN8nScript(fetchWorkflowScript);
      return typeof result === "string" && result.length > 0 ? result : null;
    } catch (error) {
      console.error("Fetch current workflow error:", error);
      throw error instanceof BrowserApiError ? error : new Error("Unknown error occurred");
    }
  }, []);

  /**
   * Add a node to the current workflow
   */
  const addNode = useCallback(async (input: AddNodeInput): Promise<string | false> => {
    try {
      const result = await executeN8nScript(addNodeScript, [input]);
      return result?.success && typeof result.nodeId === "string" ? result.nodeId : false;
    } catch (error) {
      console.error("Add node error:", error);
      return false;
    }
  }, []);

  /**
   * Delete/clear the current workflow
   */
  const deleteCurrentWorkflow = useCallback(async (): Promise<boolean> => {
    try {
      const result = await executeN8nScript(deleteWorkflowScript);
      return result?.success || false;
    } catch (error) {
      console.error("Delete workflow error:", error);
      return false;
    }
  }, []);

  /**
   * Write a complete workflow from JSON string
   */
  const writeWorkflowFromJson = useCallback(async (workflowJsonString: string): Promise<boolean> => {
    try {
      const result = await executeN8nScript(writeWorkflowFromJsonScript, [workflowJsonString]);
      return result?.success || false;
    } catch (error) {
      console.error("Write workflow error:", error);
      return false;
    }
  }, []);

  /**
   * Get detailed node information by ID
   */
  const getNodeInfoById = useCallback(async (nodeId: string): Promise<NodeInfo | null> => {
    try {
      const result = await executeN8nScript(getNodeInfoByIdScript, [nodeId]);
      return result?.success && result.nodeInfo ? result.nodeInfo : null;
    } catch (error) {
      console.error("Get node info error:", error);
      return null;
    }
  }, []);

  /**
   * Delete a specific node by ID
   */
  const deleteNode = useCallback(async (nodeId: string): Promise<boolean> => {
    try {
      const result = await executeN8nScript(deleteNodeScript, [nodeId]);
      return result?.success || false;
    } catch (error) {
      console.error("Delete node error:", error);
      return false;
    }
  }, []);

  /**
   * Connect two nodes
   */
  const connectNodes = useCallback(async (input: ConnectNodesInput): Promise<boolean> => {
    try {
      const result = await executeN8nScript(connectNodesScript, [input]);
      return result?.success || false;
    } catch (error) {
      console.error("Connect nodes error:", error);
      return false;
    }
  }, []);

  /**
   * Apply workflow modifications
   */
  const applyWorkflowModifications = useCallback(async (modifications: unknown): Promise<boolean> => {
    try {
      const result = await executeN8nScript(applyWorkflowModificationsScript, [modifications]);
      return result?.success || false;
    } catch (error) {
      console.error("Apply workflow modifications error:", error);
      return false;
    }
  }, []);

  return {
    getErrorNodes,
    getUnavailableNodes,
    fetchCurrentWorkflow,
    addNode,
    deleteCurrentWorkflow,
    writeWorkflowFromJson,
    getNodeInfoById,
    deleteNode,
    connectNodes,
    applyWorkflowModifications,
  };
};