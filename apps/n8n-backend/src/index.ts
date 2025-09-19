import "../instrumentation"; // Must be the first import
import dotenv from "dotenv";
dotenv.config();
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {
  convertToModelMessages,
  smoothStream,
  streamText,
  experimental_createMCPClient,
  type UIMessage,
  generateId,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { cors } from "hono/cors";
import { z } from "zod";
import { auth } from "./lib/auth.js";
import { getGenerations, incrementGenerations } from "./lib/generations.js";
import { loadSystemPromptText } from "./utils/helperFunctions.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { LangfuseClient } from "@langfuse/client";

const app = new Hono();

// Initialize MCP client with error handling
let mcpClient: any = null;
try {
  if (process.env.SMITHERY_API_KEY) {
    mcpClient = await experimental_createMCPClient({
      transport: new StreamableHTTPClientTransport(
        new URL(
          `https://server.smithery.ai/@upstash/context7-mcp/mcp?api_key=${process.env.SMITHERY_API_KEY}`
        )
      ),
    });
    console.log("MCP client initialized successfully");
  } else {
    console.warn("SMITHERY_API_KEY not found, MCP client disabled");
  }
} catch (error) {
  console.error("Failed to initialize MCP client:", error);
  console.warn("Continuing without MCP client");
}
// better-auth routes
app.all("/api/auth/**", async (c) => {
  return auth.handler(c.req.raw);
});

const EXTENSION_IDS = [""];

app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: false,
  })
);

// Initialize OpenRouter with error handling
let openrouter: any = null;
try {
  if (process.env.OPENROUTER_API_KEY) {
    openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    console.log("OpenRouter client initialized successfully");
  } else {
    console.error("OPENROUTER_API_KEY not found, OpenRouter client disabled");
  }
} catch (error) {
  console.error("Failed to initialize OpenRouter client:", error);
}

/**
 * HTTP(S) API test tool used to pre-validate endpoints before creating or editing workflow nodes.
 * Returns status, headers, and a truncated response preview. Supports query, headers, and body.
 */
const fetchApiParameters = z.object({
  method: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
    .describe("HTTP method to use."),
  url: z.string().url().describe("Absolute HTTP(S) URL to call."),
  headers: z
    .record(z.string(), z.string())
    .default({})
    .describe("Optional request headers as key-value pairs."),
  query: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .default({})
    .describe("Optional query parameters to append to the URL."),
  body: z
    .union([z.string(), z.record(z.string(), z.unknown())])
    .optional()
    .describe(
      "Optional request body as string or JSON object (for non-GET methods)."
    ),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .max(120000)
    .default(15000)
    .describe("Request timeout in milliseconds (max 120000)."),
  followRedirects: z
    .boolean()
    .default(true)
    .describe(
      "Whether to follow HTTP redirects (true) or return 3xx responses directly (false)."
    ),
});
type FetchApiInput = z.infer<typeof fetchApiParameters>;

const fetchApiTool = {
  description:
    "Perform an HTTP(S) request to test API endpoints before implementing nodes. Returns status, headers, and a truncated response preview.",
  inputSchema: fetchApiParameters,
  /**
   * Execute the HTTP request with robust validation and timeouts.
   */
  execute: async ({
    method,
    url,
    headers,
    query,
    body,
    timeoutMs,
    followRedirects,
  }: FetchApiInput) => {
    // Validate scheme early to avoid SSRF to non-HTTP(S) protocols
    const parsedUrl = new URL(url);
    const scheme = parsedUrl.protocol.toLowerCase();
    if (scheme !== "http:" && scheme !== "https:") {
      return {
        ok: false,
        error: "Only HTTP(S) URLs are allowed.",
      };
    }

    // Append query parameters safely
    const queryEntries = Object.entries(query);
    for (const [key, value] of queryEntries) {
      parsedUrl.searchParams.set(key, String(value));
    }

    // Prepare headers with case-insensitive keys preserved as provided
    const requestHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      requestHeaders[k] = v;
    }

    // Prepare body
    let requestBody: string | undefined = undefined;
    if (typeof body === "string") {
      requestBody = body;
    } else if (body !== undefined) {
      // JSON body: ensure Content-Type
      if (
        Object.keys(requestHeaders).find(
          (h) => h.toLowerCase() === "content-type"
        ) === undefined
      ) {
        requestHeaders["Content-Type"] = "application/json";
      }
      requestBody = JSON.stringify(body);
    }

    // Setup timeout via AbortController
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(parsedUrl.toString(), {
        method,
        headers: requestHeaders,
        body: ["GET", "HEAD"].includes(method) ? undefined : requestBody,
        redirect: followRedirects ? "follow" : "manual",
        signal: controller.signal,
      });

      // Collect headers (at most first 25 to keep response compact)
      const responseHeadersObj: Record<string, string> = {};
      let headerCount = 0;
      for (const [hk, hv] of response.headers.entries()) {
        responseHeadersObj[hk] = hv;
        headerCount += 1;
        if (headerCount >= 25) break;
      }

      // Read body as text, attempt JSON parse for preview
      const contentType = response.headers.get("content-type") ?? "";
      const isJson = contentType.toLowerCase().includes("application/json");
      const rawText = await response.text();
      const maxChars = 5000;
      const bodyPreview =
        rawText.length > maxChars
          ? `${rawText.slice(0, maxChars)}\n\n[truncated ${rawText.length - maxChars} chars]`
          : rawText;

      let jsonPreview: string | null = null;
      if (isJson) {
        try {
          const parsed = JSON.parse(rawText) as unknown;
          let preview = JSON.stringify(parsed, null, 2);
          if (preview.length > maxChars) {
            preview = `${preview.slice(0, maxChars)}\n\n[truncated ${preview.length - maxChars} chars]`;
          }
          jsonPreview = preview;
        } catch {
          jsonPreview = null;
        }
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        headers: responseHeadersObj,
        contentType,
        bodyPreview,
        jsonPreview,
      };
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      return {
        ok: false,
        error: isAbort
          ? `Request timed out after ${timeoutMs}ms`
          : error instanceof Error
            ? error.message
            : "Unknown error",
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

// Initialize the Langfuse client with error handling
let langfuse: any = null;
try {
  langfuse = new LangfuseClient();
  console.log("Langfuse client initialized successfully");
} catch (error) {
  console.error("Failed to initialize Langfuse client:", error);
  console.warn("Continuing without Langfuse client");
}

app.post("/", async (c) => {
  console.log("Generation Request received");
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const { generations, reset } = await getGenerations(session.user.id);

  if (generations >= 100) {
    return c.json(
      {
        message:
          "You have reached the maximum number of generations for this month. Please wait until the first day of the next month to continue.",
      },
      403
    );
  }
  console.log("Generations found");

  try {
    const {
      messages,
      model,
      chatId,
      // workflowJson,
    }: {
      messages: UIMessage[];
      chatId: string;
      model?: string;

      // workflowJson?: string
    } = await c.req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json(
        { error: "Messages array is required and cannot be empty" },
        400
      );
    }

    // if (workflowJson) {
    //   messages.push({
    //     id: generateId(),
    //     role: "system",
    //     parts: [
    //       {
    //         type: "text",
    //         text: "This is the current workflow present on the n8n canvas.",
    //       },
    //       {
    //         type: "data-json",
    //         data: workflowJson ?? "",
    //       },
    //     ],
    //   });
    // }

    // console.log("workflowJson", workflowJson);
    const mcpTools = mcpClient ? await mcpClient.tools() : {};

    // Debug: Log the model being used and MCP tools structure
    console.log("Using model:", model || "openai/gpt-5");
    console.log("MCP tools count:", Object.keys(mcpTools).length);
    console.log("Is Grok model:", model?.includes("grok") || false);

    // Create tools object - use ultra-simplified version for Grok models
    const isGrokModel = model?.includes("grok") || false;
    const tools = isGrokModel
      ? {
          get_current_workflow: {
            description:
              "Retrieve the active n8n workflow from the current browser tab by reading the Vue/Pinia store and return it in a simplified export JSON (nodes, connections, pinData, meta). Use this to inspect the canvas state before planning modifications.",
            inputSchema: z.object({
              toggle: z
                .boolean()
                .describe("The toggle to get the current workflow in n8n."),
            }),
          },
          write_workflow: {
            description:
              "Write a new n8n workflow to the active tab from a JSON string. The JSON must follow n8n's legacy connections format: connections is an object keyed by source node name; each value is an object keyed by outputType (e.g., 'main'); each value is an array of arrays of Connection objects where Connection = { node: string, type?: 'main' | string, index?: number }. Use when there is no existing workflow or you want to seed a new canvas.",
            inputSchema: z.object({
              workflowJson: z
                .string()
                .describe(
                  "Stringified full workflow object to set in the n8n store. Required shape: { nodes: Node[], connections: Record<string, Record<string, Connection[][]>> }."
                ),
            }),
          },
          delete_workflow: {
            description:
              "Delete/clear the current n8n workflow on the active tab, resetting the Pinia store and Vue Flow state to an empty workflow.",
            inputSchema: z.object({
              confirm: z
                .boolean()
                .describe(
                  "Set to true to confirm deletion of current workflow."
                ),
            }),
          },
          add_node: {
            description:
              "Add a new node to the current n8n workflow at a given position with parameters.",
            inputSchema: z.object({
              nodeType: z.string().describe("The node's type"),
              nodeName: z.string().describe("The node's display name"),
              parameters: z.string().describe("Node parameters as JSON string"),
              positionX: z.number().describe("X position on canvas"),
              positionY: z.number().describe("Y position on canvas"),
            }),
          },
          delete_node: {
            description:
              "Delete a node by id from the current n8n workflow and clean up connections.",
            inputSchema: z.object({
              nodeId: z.string().describe("The id of the node to delete"),
            }),
          },
          modify_workflow: {
            description:
              "Modify the current n8n workflow. Supports adding nodes, updating connections, or updating a node.",
            inputSchema: z.object({
              modifications: z
                .string()
                .describe(
                  "Modifications as JSON string with optional keys: nodes (array), connections (object), updateNode (object)"
                ),
            }),
          },
          get_node_info: {
            description:
              "Get detailed information about a node by id, including inbound and outbound connections.",
            inputSchema: z.object({
              nodeId: z
                .string()
                .describe("The id of the node to inspect (string id)."),
            }),
          },
          get_error_nodes: {
            description:
              "List nodes currently showing issues in the UI (e.g., error state). Returns id, name, type, position and issue messages.",
            inputSchema: z.object({
              toggle: z.boolean().default(true).describe("No-op flag"),
            }),
          },
          get_unavailable_nodes: {
            description:
              "List nodes whose types appear unavailable on this instance (best-effort heuristic).",
            inputSchema: z.object({
              toggle: z.boolean().default(true).describe("No-op flag"),
            }),
          },
          connect_nodes: {
            description:
              "Connect two nodes by id. Defaults: outputType 'main', arrayIndex 0, inputType 'main', index 0.",
            inputSchema: z.object({
              from: z.object({
                nodeId: z.string().describe("Source node id"),
                outputType: z.string().optional(),
                arrayIndex: z.number().optional(),
              }),
              to: z.object({
                nodeId: z.string().describe("Target node id"),
                inputType: z.string().optional(),
                index: z.number().optional(),
              }),
            }),
          },
        }
      : {
          get_current_workflow: {
            description:
              "Retrieve the active n8n workflow from the current browser tab by reading the Vue/Pinia store and return it in a simplified export JSON (nodes, connections, pinData, meta). Use this to inspect the canvas state before planning modifications.",
            inputSchema: z.object({
              toggle: z
                .boolean()
                .describe("The toggle to get the current workflow in n8n."),
            }),
          },
          // Local HTTP test tool for validating APIs before node creation/edits
          fetch_api: fetchApiTool,
          write_workflow: {
            description:
              "Write a new n8n workflow to the active tab from a JSON string. Use when there is no existing workflow or you want to seed a new canvas.",
            inputSchema: z.object({
              workflowJson: z
                .string()
                .describe(
                  "Stringified full workflow object to set in the n8n store."
                ),
            }),
          },
          delete_workflow: {
            description:
              "Delete/clear the current n8n workflow on the active tab, resetting the Pinia store and Vue Flow state to an empty workflow.",
            inputSchema: z.object({
              confirm: z
                .boolean()
                .describe(
                  "Set to true to confirm deletion of current workflow."
                ),
            }),
          },
          add_node: {
            description:
              "Add a new node to the current n8n workflow at a given position with parameters.",
            inputSchema: z.object({
              nodeType: z.string().describe("The node's type"),
              nodeName: z.string().describe("The node's display name"),
              parameters: z
                .record(z.string(), z.unknown())
                .default({})
                .describe("Node parameters object"),
              position: z
                .tuple([z.number(), z.number()])
                .default([0, 0])
                .describe("[x, y] position on canvas"),
            }),
          },
          delete_node: {
            description:
              "Delete a node by id from the current n8n workflow and clean up connections.",
            inputSchema: z.object({
              nodeId: z.string().describe("The id of the node to delete"),
            }),
          },
          modify_workflow: {
            description:
              "Modify the current n8n workflow. Supports adding nodes, updating connections, or updating a node. Connections must use legacy shape: outputType -> Array<Array<Connection>> where Connection = { node: string, type?: string, index?: number }.",
            inputSchema: z.object({
              modifications: z
                .object({
                  nodes: z.array(z.record(z.string(), z.unknown())).optional(),
                  connections: z.record(z.string(), z.unknown()).optional(),
                  updateNode: z.record(z.string(), z.unknown()).optional(),
                })
                .describe(
                  "Object with optional keys: nodes (array), connections (object in legacy shape), updateNode (object)."
                ),
            }),
          },
          get_node_info: {
            description:
              "Get detailed information about a node by id, including inbound and outbound connections.",
            inputSchema: z.object({
              nodeId: z
                .string()
                .describe("The id of the node to inspect (string id)."),
            }),
          },
          get_error_nodes: {
            description:
              "List nodes currently showing issues in the UI (e.g., error state). Returns id, name, type, position and issue messages.",
            inputSchema: z.object({
              toggle: z.boolean().default(true).describe("No-op flag"),
            }),
          },
          get_unavailable_nodes: {
            description:
              "List nodes whose types appear unavailable on this instance (best-effort heuristic).",
            inputSchema: z.object({
              toggle: z.boolean().default(true).describe("No-op flag"),
            }),
          },
          connect_nodes: {
            description:
              "Connect two nodes by id. Defaults: outputType 'main', arrayIndex 0, inputType 'main', index 0.",
            inputSchema: z.object({
              from: z.object({
                nodeId: z.string().describe("Source node id"),
                outputType: z.string().optional(),
                arrayIndex: z.number().optional(),
              }),
              to: z.object({
                nodeId: z.string().describe("Target node id"),
                inputType: z.string().optional(),
                index: z.number().optional(),
              }),
            }),
          },
          // askForConfirmation: {
          //   description: "Ask the user for confirmation.",
          //   inputSchema: z.object({
          //     message: z
          //       .string()
          //       .describe("The message to ask for confirmation."),
          //   }),
          // },
          ...mcpTools,
        };

    // Try with tools first, fallback to no tools for Grok if it fails
    let result;

    if (!openrouter) {
      return c.json({ error: "OpenRouter API key not configured" }, 500);
    }

    const SYSTEM_PROMPT = langfuse
      ? await langfuse.prompt.get("SYSTEM_PROMPT")
      : { prompt: "You are a helpful AI assistant." };
    try {
      // Get production prompt
      result = streamText({
        model: openrouter("z-ai/glm-4.5:nitro"),
        // model: groq("qwen/qwen3-32b"),
        messages: convertToModelMessages(messages.slice(-4)),
        experimental_transform: smoothStream({
          delayInMs: 10, // optional: defaults to 10ms
          chunking: "word", // optional: defaults to 'word'
        }),
        experimental_telemetry: {
          isEnabled: true,
        },
        // toolChoice: "required",
        tools, // Include tools for all models
        system: SYSTEM_PROMPT.prompt,
      });
    } catch (toolError) {
      if (
        isGrokModel &&
        toolError instanceof Error &&
        toolError.message.includes("Invalid function schema")
      ) {
        console.log("Grok model failed with tools, retrying without tools...");
        result = streamText({
          model: openrouter(model || "openai/gpt-5"),
          messages: convertToModelMessages(messages),
          experimental_transform: smoothStream({
            delayInMs: 20, // optional: defaults to 10ms
            chunking: "word", // optional: defaults to 'word'
          }),

          system: SYSTEM_PROMPT.prompt,
        });
      } else {
        throw toolError;
      }
    }

    c.header("Content-Type", "text/plain; charset=utf-8");

    return result.toUIMessageStreamResponse({
      onFinish: async (output) => {
        if (messages[messages.length - 1].role === "user") {
          ("");
          await incrementGenerations(session.user.id);
          console.log("Generations incremented after user message");
        }
      },
      sendReasoning: false,
    });
  } catch (error) {
    console.error("Error processing request:", error);

    // Check if it's a Grok-specific function schema error
    if (
      error instanceof Error &&
      error.message.includes("Invalid function schema")
    ) {
      console.error("Grok model function schema error detected");
      return c.json(
        {
          error:
            "Function schema validation failed for this model. Please try a different model like Claude or Gemini.",
          details:
            "Grok Code Fast has stricter function schema validation requirements.",
        },
        400
      );
    }

    return c.json({ error: "Internal server error" }, 500);
  }
});

app.get("/generations", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const { generations } = await getGenerations(session.user.id);
  return c.json({ generations });
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

serve(
  {
    fetch: app.fetch,
    port: 5000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
