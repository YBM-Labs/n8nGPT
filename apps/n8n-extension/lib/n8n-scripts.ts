import {
  NODE_TYPE_VERSIONS,
  VUE_FLOW_FLOW_KEY,
  ERROR_MESSAGES,
} from "./constants";
import type {
  ErrorNode,
  UnavailableNode,
  N8nNode,
  NodeInfo,
  AddNodeInput,
} from "./types";

/**
 * Script to get error nodes from the current n8n workflow
 */
export const getErrorNodesScript = () => {
  try {
    const collectIssues = (n: Record<string, unknown>): Array<string> => {
      const issues = (n?.["data"] as Record<string, unknown> | undefined)?.[
        "issues"
      ];
      const items: Array<unknown> = Array.isArray(
        (issues as Record<string, unknown> | undefined)?.["items"]
      )
        ? ((issues as Record<string, unknown>)?.["items"] as Array<unknown>)
        : [];
      const messages: Array<string> = [];
      for (const it of items) {
        const msg = (it as Record<string, unknown>)?.["message"];
        if (typeof msg === "string" && msg.length > 0) messages.push(msg);
      }
      const visible = Boolean(
        (issues as Record<string, unknown> | undefined)?.["visible"] ?? false
      );
      if (messages.length === 0 && visible) messages.push("Issue visible");
      return messages;
    };

    const allElements = document.querySelectorAll("*");
    for (const el of Array.from(allElements) as any[]) {
      const vueInstance =
        (el as any).__vueParentComponent || (el as any)._vnode?.component;
      if (vueInstance?.appContext) {
        const globals = vueInstance.appContext.app.config.globalProperties;
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
        const flow = vueFlowStorage?.flows?.get(VUE_FLOW_FLOW_KEY);
        if (!flow) continue;

        const errorNodes: Array<Record<string, unknown>> = [];
        for (const n of flow.nodes.value as Array<Record<string, unknown>>) {
          const issues = collectIssues(n);
          if (issues.length > 0) {
            const id = String(n?.["id"] ?? "");
            const data = (n?.["data"] ?? {}) as Record<string, unknown>;
            const name = String(data?.["name"] ?? "");
            const type = String(data?.["type"] ?? "");
            const pos = (n?.["position"] as [number, number]) ?? [0, 0];
            errorNodes.push({ id, name, type, position: pos, issues });
          }
        }
        return { success: true, nodes: errorNodes } as const;
      }
    }
    return { success: false, nodes: [] } as const;
  } catch {
    return { success: false, nodes: [] } as const;
  }
};

/**
 * Script to get unavailable nodes from the current n8n workflow
 */
export const getUnavailableNodesScript = () => {
  try {
    const parseTranslate = (el: HTMLElement): [number, number] => {
      const t = (el as HTMLElement)?.style?.transform || "";
      const m = t.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      if (m) return [Number(m[1]), Number(m[2])];
      return [0, 0];
    };

    const nodes = document.querySelectorAll(".vue-flow__node[data-id]");
    const out: Array<{
      id: string;
      name: string;
      type: string;
      position: [number, number];
    }> = [];

    for (const el of Array.from(nodes)) {
      const nodeEl = el as HTMLElement;
      const id = nodeEl.getAttribute("data-id") || "";
      const cn = nodeEl.querySelector(
        '[data-test-id="canvas-node"]'
      ) as HTMLElement | null;
      const name = cn?.getAttribute("data-node-name") || "";
      const type = cn?.getAttribute("data-node-type") || "";
      const defaultNode = nodeEl.querySelector(
        '[data-test-id="canvas-default-node"]'
      ) as HTMLElement | null;
      if (!defaultNode) continue;

      const placeholderEl = defaultNode.querySelector(
        '._nodeIconPlaceholder_5jwz1_152, [class*="nodeIconPlaceholder"]'
      ) as HTMLElement | null;
      const placeholderText = (placeholderEl?.textContent || "").trim();
      const hasImg = !!defaultNode.querySelector(
        '.n8n-node-icon img, [class*="nodeIconImage"] img'
      );
      const hasSvg = !!defaultNode.querySelector(".n8n-node-icon svg");

      const isUnavailable =
        placeholderEl && placeholderText === "?" && !(hasImg || hasSvg);
      if (isUnavailable) {
        out.push({ id, name, type, position: parseTranslate(nodeEl) });
      }
    }
    return { success: true, nodes: out } as const;
  } catch {
    return { success: false, nodes: [] } as const;
  }
};

/**
 * Script to fetch the current workflow from n8n
 */
export const fetchWorkflowScript = () => {
  try {
    const allElements = document.querySelectorAll("*");
    for (const el of Array.from(allElements)) {
      const vueInstance =
        (el as any).__vueParentComponent || (el as any)._vnode?.component;
      if (vueInstance?.appContext) {
        const globals = vueInstance.appContext.app.config.globalProperties;
        const workflowsStore = globals?.$pinia?._s?.get("workflows");
        const fullWorkflow = workflowsStore?.workflow;

        if (!fullWorkflow) continue;

        const nodesArray = Array.isArray(fullWorkflow.nodes)
          ? fullWorkflow.nodes
          : [];
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
          connections: (fullWorkflow && fullWorkflow.connections) || {},
          pinData: (fullWorkflow && fullWorkflow.pinData) || {},
          meta: {
            instanceId:
              (fullWorkflow &&
                fullWorkflow.meta &&
                fullWorkflow.meta.instanceId) ||
              null,
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
};

/**
 * Script to add a node to the current workflow
 */
export const addNodeScript = (payload: AddNodeInput) => {
  try {
    const getNodeTypeVersion = (type: string): number => {
      return typeof NODE_TYPE_VERSIONS[type] === "number"
        ? NODE_TYPE_VERSIONS[type]
        : 1;
    };

    const allElements = document.querySelectorAll("*");
    for (const el of Array.from(allElements) as any[]) {
      const vueInstance =
        (el as any).__vueParentComponent || (el as any)._vnode?.component;
      if (vueInstance?.appContext) {
        const globals = vueInstance.appContext.app.config.globalProperties;
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

        const newNodeId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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

        const flow = vueFlowStorage?.flows?.get(VUE_FLOW_FLOW_KEY);
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
};

/**
 * Script to delete a workflow completely
 */
export const deleteWorkflowScript = () => {
  try {
    const allElements = document.querySelectorAll("*");
    for (const el of Array.from(allElements) as any[]) {
      const vueInstance =
        (el as any).__vueParentComponent || (el as any)._vnode?.component;
      if (vueInstance?.appContext) {
        const globals = vueInstance.appContext.app.config.globalProperties;
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
          settings: { executionOrder: "v1" },
          tags: [] as Array<unknown>,
          pinData: {} as Record<string, unknown>,
          meta: { instanceId: null as string | null },
        };

        try {
          if (typeof (workflowsStore as any).$patch === "function") {
            (workflowsStore as any).$patch({ workflow: emptyWorkflow });
          } else {
            (workflowsStore as any).workflow = emptyWorkflow;
          }

          const flow = vueFlowStorage.flows?.get(VUE_FLOW_FLOW_KEY);
          if (flow) {
            flow.nodes.value.splice(0, flow.nodes.value.length);
            flow.edges.value.splice(0, flow.edges.value.length);
          }

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
};

/**
 * Script to write a complete workflow from JSON string
 */
export const writeWorkflowFromJsonScript = (workflowJsonString: string) => {
  try {
    let workflowData: any;
    try {
      workflowData = JSON.parse(workflowJsonString);
    } catch {
      return { success: false, message: "Invalid JSON format" };
    }

    const allElements = document.querySelectorAll("*");
    for (const el of Array.from(allElements) as any[]) {
      const vueInstance =
        (el as any).__vueParentComponent || (el as any)._vnode?.component;
      if (vueInstance?.appContext) {
        const globals = vueInstance.appContext.app.config.globalProperties;
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

        try {
          const newWorkflow = {
            id: workflowData.id || null,
            name: workflowData.name || "Imported Workflow",
            active: workflowData.active || false,
            nodes: Array.isArray(workflowData.nodes) ? workflowData.nodes : [],
            connections: workflowData.connections || {},
            settings: workflowData.settings || { executionOrder: "v1" },
            tags: workflowData.tags || [],
            pinData: workflowData.pinData || {},
            meta: workflowData.meta || { instanceId: null },
          };

          // Update workflow store
          if (typeof (workflowsStore as any).$patch === "function") {
            (workflowsStore as any).$patch({ workflow: newWorkflow });
          } else {
            (workflowsStore as any).workflow = newWorkflow;
          }

          const flow = vueFlowStorage.flows?.get("__EMPTY__"); // Use correct key
          if (flow) {
            // Clear existing nodes and edges
            flow.nodes.value.splice(0, flow.nodes.value.length);
            flow.edges.value.splice(0, flow.edges.value.length);

            // Create Vue Flow nodes with complete structure
            const vueFlowNodes = newWorkflow.nodes.map((node: any) => ({
              id: node.id,
              type: "canvas-node",
              dimensions: { width: 100, height: 100 },
              computedPosition: {
                x: Number(node.position?.[0] ?? 0),
                y: Number(node.position?.[1] ?? 0),
                z: 1000,
              },
              handleBounds: {
                source: [
                  {
                    id: "outputs/main/0",
                    position: "right",
                    nodeId: node.id,
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
                x: Number(node.position?.[0] ?? 0),
                y: Number(node.position?.[1] ?? 0),
              },
              data: {
                ...node,
                inputs: node.inputs || [],
                outputs: node.outputs || [{ type: "main", index: 0 }],
                connections: { inputs: {}, outputs: {} },
                issues: { items: [], visible: false },
                pinnedData: { count: 0, visible: false },
                execution: { status: "unknown", running: false },
                render: {
                  type: "default",
                  options: {
                    trigger: node.type?.includes("trigger") || false,
                    configuration: false,
                    configurable: true,
                    inputs: { labelSize: "small" },
                    outputs: { labelSize: "small" },
                  },
                },
              },
              events: {},
              label: node.name,
            }));

            flow.nodes.value.push(...vueFlowNodes);

            // Create Vue Flow edges using node IDs (not names)
            if (newWorkflow.connections) {
              const vueFlowEdges: any[] = [];
              Object.entries(newWorkflow.connections).forEach(
                ([fromNodeName, connections]: any) => {
                  const fromNode = newWorkflow.nodes.find(
                    (n: any) => n.name === fromNodeName
                  );
                  if (!fromNode) return;

                  Object.entries(connections).forEach(
                    ([outputType, connectionArray]: any) => {
                      if (Array.isArray(connectionArray)) {
                        connectionArray.forEach(
                          (connection: any, arrayIndex: number) => {
                            if (Array.isArray(connection)) {
                              connection.forEach((conn: any) => {
                                const toNode = newWorkflow.nodes.find(
                                  (n: any) => n.name === conn.node
                                );
                                if (toNode) {
                                  const edgeId = `${fromNode.id}-${toNode.id}-${Date.now()}-${Math.random()}`;
                                  vueFlowEdges.push({
                                    id: edgeId,
                                    source: fromNode.id, // Use node ID, not name
                                    target: toNode.id, // Use node ID, not name
                                    sourceHandle: `outputs/${outputType}/${arrayIndex}`,
                                    targetHandle: `inputs/${conn.type}/${conn.index}`,
                                  });
                                }
                              });
                            }
                          }
                        );
                      }
                    }
                  );
                }
              );
              flow.edges.value.push(...vueFlowEdges);
            }
          }

          // Force Vue reactivity update
          setTimeout(() => {
            if (typeof (workflowsStore as any).$patch === "function") {
              (workflowsStore as any).$patch({});
            }
          }, 100);

          return { success: true, message: "Workflow imported successfully" };
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
};

/**
 * Script to get detailed node information by ID
 */
export const getNodeInfoByIdScript = (nodeId: string) => {
  try {
    const allElements = document.querySelectorAll("*");
    for (const el of Array.from(allElements) as any[]) {
      const vueInstance =
        (el as any).__vueParentComponent || (el as any)._vnode?.component;
      if (vueInstance?.appContext) {
        const globals = vueInstance.appContext.app.config.globalProperties;
        const workflowsStore = globals?.$pinia?._s?.get
          ? globals.$pinia._s.get("workflows")
          : globals?.$pinia?._s?.["workflows"];

        if (!workflowsStore) continue;

        const currentWorkflow = (workflowsStore as any)?.workflow;
        if (!currentWorkflow || !Array.isArray(currentWorkflow.nodes)) continue;

        const node = currentWorkflow.nodes.find((n: any) => n.id === nodeId);
        if (!node) continue;

        const inboundConnections: any[] = [];
        const outboundConnections: any[] = [];

        if (currentWorkflow.connections) {
          Object.entries(currentWorkflow.connections).forEach(
            ([fromNodeName, connections]: any) => {
              Object.entries(connections).forEach(
                ([outputType, connectionArray]: any) => {
                  if (Array.isArray(connectionArray)) {
                    connectionArray.forEach(
                      (connection: any, arrayIndex: number) => {
                        connection.forEach((conn: any) => {
                          if (conn.node === node.name) {
                            inboundConnections.push({
                              fromNodeId: fromNodeName,
                              fromNodeName: fromNodeName,
                              outputType: outputType,
                              arrayIndex: arrayIndex,
                              type: conn.type,
                              index: conn.index,
                            });
                          }
                        });
                      }
                    );
                  }
                }
              );
            }
          );

          if (currentWorkflow.connections[node.name]) {
            Object.entries(currentWorkflow.connections[node.name]).forEach(
              ([outputType, connectionArray]: any) => {
                if (Array.isArray(connectionArray)) {
                  connectionArray.forEach(
                    (connection: any, arrayIndex: number) => {
                      connection.forEach((conn: any) => {
                        outboundConnections.push({
                          toNodeId: conn.node,
                          toNodeName: conn.node,
                          outputType: outputType,
                          arrayIndex: arrayIndex,
                          type: conn.type,
                          index: conn.index,
                        });
                      });
                    }
                  );
                }
              }
            );
          }
        }

        const nodeInfo: NodeInfo = {
          node: {
            id: node.id,
            name: node.name,
            type: node.type,
            typeVersion: node.typeVersion || 1,
            position: node.position || [0, 0],
            disabled: node.disabled || false,
            parameters: node.parameters || {},
            ...(node.webhookId ? { webhookId: node.webhookId } : {}),
          },
          inbound: inboundConnections,
          outbound: outboundConnections,
        };

        return { success: true, nodeInfo };
      }
    }
    return { success: false, nodeInfo: null };
  } catch (e) {
    return { success: false, nodeInfo: null };
  }
};

/**
 * Script to delete a specific node by ID
 */
export const deleteNodeScript = (nodeId: string) => {
  try {
    const allElements = document.querySelectorAll("*");
    for (const el of Array.from(allElements) as any[]) {
      const vueInstance =
        (el as any).__vueParentComponent || (el as any)._vnode?.component;
      if (vueInstance?.appContext) {
        const globals = vueInstance.appContext.app.config.globalProperties;
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

        if (!workflowsStore || !vueFlowStorage) continue;

        const currentWorkflow = (workflowsStore as any)?.workflow;
        if (!currentWorkflow || !Array.isArray(currentWorkflow.nodes)) continue;

        const nodeIndex = currentWorkflow.nodes.findIndex(
          (n: any) => n.id === nodeId
        );
        if (nodeIndex === -1) continue;

        const nodeToDelete = currentWorkflow.nodes[nodeIndex];
        currentWorkflow.nodes.splice(nodeIndex, 1);

        if (currentWorkflow.connections) {
          delete currentWorkflow.connections[nodeToDelete.name];

          Object.keys(currentWorkflow.connections).forEach((fromNodeName) => {
            const fromNodeConnections =
              currentWorkflow.connections[fromNodeName];
            Object.keys(fromNodeConnections).forEach((outputType) => {
              const connectionArray = fromNodeConnections[outputType];
              if (Array.isArray(connectionArray)) {
                fromNodeConnections[outputType] = connectionArray.map(
                  (connections: any[]) =>
                    connections.filter(
                      (conn: any) => conn.node !== nodeToDelete.name
                    )
                );
              }
            });
          });
        }

        const flow = vueFlowStorage.flows?.get(VUE_FLOW_FLOW_KEY);
        if (flow) {
          const vueNodeIndex = flow.nodes.value.findIndex(
            (n: any) => n.id === nodeId
          );
          if (vueNodeIndex !== -1) {
            flow.nodes.value.splice(vueNodeIndex, 1);
          }

          flow.edges.value = flow.edges.value.filter(
            (edge: any) =>
              edge.source !== nodeToDelete.name &&
              edge.target !== nodeToDelete.name
          );
        }

        if (typeof (workflowsStore as any).$patch === "function") {
          (workflowsStore as any).$patch({ workflow: currentWorkflow });
        } else {
          (workflowsStore as any).workflow = currentWorkflow;
        }

        return {
          success: true,
          message: `Node ${nodeId} deleted successfully`,
        };
      }
    }
    return {
      success: false,
      message: "Vue instance not found or node not found",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, message: msg };
  }
};

/**
 * Script to connect two nodes
 */
export const connectNodesScript = (input: {
  from: { nodeId: string; outputType?: string; arrayIndex?: number };
  to: { nodeId: string; inputType?: string; index?: number };
}) => {
  try {
    const allElements = document.querySelectorAll("*");
    for (const el of Array.from(allElements) as any[]) {
      const vueInstance =
        (el as any).__vueParentComponent || (el as any)._vnode?.component;
      if (vueInstance?.appContext) {
        const globals = vueInstance.appContext.app.config.globalProperties;
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

        if (!workflowsStore || !vueFlowStorage) continue;

        const currentWorkflow = (workflowsStore as any)?.workflow;
        if (!currentWorkflow || !Array.isArray(currentWorkflow.nodes)) continue;

        const fromNode = currentWorkflow.nodes.find(
          (n: any) => n.id === input.from.nodeId
        );
        const toNode = currentWorkflow.nodes.find(
          (n: any) => n.id === input.to.nodeId
        );

        if (!fromNode || !toNode) continue;

        const outputType = input.from.outputType || "main";
        const arrayIndex = input.from.arrayIndex || 0;
        const inputType = input.to.inputType || "main";
        const index = input.to.index || 0;

        if (!currentWorkflow.connections) {
          currentWorkflow.connections = {};
        }
        if (!currentWorkflow.connections[fromNode.name]) {
          currentWorkflow.connections[fromNode.name] = {};
        }
        if (!currentWorkflow.connections[fromNode.name][outputType]) {
          currentWorkflow.connections[fromNode.name][outputType] = [];
        }

        while (
          currentWorkflow.connections[fromNode.name][outputType].length <=
          arrayIndex
        ) {
          currentWorkflow.connections[fromNode.name][outputType].push([]);
        }

        const existingConnection = currentWorkflow.connections[fromNode.name][
          outputType
        ][arrayIndex].find(
          (conn: any) =>
            conn.node === toNode.name &&
            conn.type === inputType &&
            conn.index === index
        );

        if (!existingConnection) {
          currentWorkflow.connections[fromNode.name][outputType][
            arrayIndex
          ].push({
            node: toNode.name,
            type: inputType,
            index: index,
          });
        }

        const flow = vueFlowStorage.flows?.get(VUE_FLOW_FLOW_KEY);
        if (flow) {
          const edgeId = `${fromNode.name}-${outputType}-${arrayIndex}-${toNode.name}-${inputType}-${index}`;
          const existingEdge = flow.edges.value.find(
            (edge: any) => edge.id === edgeId
          );

          if (!existingEdge) {
            flow.edges.value.push({
              id: edgeId,
              source: fromNode.name,
              target: toNode.name,
              sourceHandle: `${outputType}_${arrayIndex}`,
              targetHandle: `${inputType}_${index}`,
            });
          }
        }

        if (typeof (workflowsStore as any).$patch === "function") {
          (workflowsStore as any).$patch({ workflow: currentWorkflow });
        } else {
          (workflowsStore as any).workflow = currentWorkflow;
        }

        return { success: true, message: "Nodes connected successfully" };
      }
    }
    return {
      success: false,
      message: "Vue instance not found or nodes not found",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, message: msg };
  }
};

/**
 * Script to apply workflow modifications
 */
export const applyWorkflowModificationsScript = (modifications: any) => {
  try {
    const allElements = document.querySelectorAll("*");
    for (const el of Array.from(allElements) as any[]) {
      const vueInstance =
        (el as any).__vueParentComponent || (el as any)._vnode?.component;
      if (vueInstance?.appContext) {
        const globals = vueInstance.appContext.app.config.globalProperties;
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

        if (!workflowsStore || !vueFlowStorage) continue;

        const currentWorkflow = (workflowsStore as any)?.workflow;
        if (!currentWorkflow) continue;

        try {
          if (modifications.nodes) {
            if (Array.isArray(modifications.nodes)) {
              currentWorkflow.nodes = modifications.nodes;
            } else if (typeof modifications.nodes === "object") {
              Object.assign(currentWorkflow.nodes, modifications.nodes);
            }
          }

          if (modifications.connections) {
            currentWorkflow.connections = modifications.connections;
          }

          if (modifications.settings) {
            currentWorkflow.settings = {
              ...currentWorkflow.settings,
              ...modifications.settings,
            };
          }

          if (modifications.pinData) {
            currentWorkflow.pinData = modifications.pinData;
          }

          if (modifications.meta) {
            currentWorkflow.meta = {
              ...currentWorkflow.meta,
              ...modifications.meta,
            };
          }

          const flow = vueFlowStorage.flows?.get(VUE_FLOW_FLOW_KEY);
          if (flow && modifications.nodes) {
            flow.nodes.value.splice(0, flow.nodes.value.length);
            flow.edges.value.splice(0, flow.edges.value.length);

            if (Array.isArray(currentWorkflow.nodes)) {
              const vueFlowNodes = currentWorkflow.nodes.map((node: any) => ({
                id: node.id,
                type: "canvas-node",
                position: {
                  x: Number(node.position?.[0] ?? 0),
                  y: Number(node.position?.[1] ?? 0),
                },
                data: node,
                label: node.name,
              }));
              flow.nodes.value.push(...vueFlowNodes);
            }

            if (currentWorkflow.connections) {
              const vueFlowEdges: any[] = [];
              Object.entries(currentWorkflow.connections).forEach(
                ([fromNodeName, connections]: any) => {
                  Object.entries(connections).forEach(
                    ([outputType, connectionArray]: any) => {
                      if (Array.isArray(connectionArray)) {
                        connectionArray.forEach(
                          (connection: any, index: number) => {
                            connection.forEach((conn: any) => {
                              const edgeId = `${fromNodeName}-${outputType}-${index}-${conn.node}-${conn.type}-${conn.index}`;
                              vueFlowEdges.push({
                                id: edgeId,
                                source: fromNodeName,
                                target: conn.node,
                                sourceHandle: `${outputType}_${index}`,
                                targetHandle: `${conn.type}_${conn.index}`,
                              });
                            });
                          }
                        );
                      }
                    }
                  );
                }
              );
              flow.edges.value.push(...vueFlowEdges);
            }
          }

          if (typeof (workflowsStore as any).$patch === "function") {
            (workflowsStore as any).$patch({ workflow: currentWorkflow });
          } else {
            (workflowsStore as any).workflow = currentWorkflow;
          }

          return {
            success: true,
            message: "Workflow modifications applied successfully",
          };
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
};
