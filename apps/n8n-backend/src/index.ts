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
import dotenv from "dotenv";
import { auth } from "./lib/auth.js";
import { getGenerations, incrementGenerations } from "./lib/generations.js";
import { loadSystemPromptText } from "./utils/helperFunctions.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
dotenv.config();

const app = new Hono();
const mcpClient = await experimental_createMCPClient({
  transport: new StreamableHTTPClientTransport(
    new URL(
      `https://server.smithery.ai/@upstash/context7-mcp/mcp?api_key=${process.env.SMITHERY_API_KEY}`
    )
  ),
});
// better-auth routes
app.all("/api/auth/**", async (c) => {
  return auth.handler(c.req.raw);
});

const EXTENSION_IDS = [""];
const ALLOWED_ORIGINS = ["http://localhost:5000", ...EXTENSION_IDS];
app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: false,
  })
);

// Load once at startup to avoid reading from disk on every request
const SYSTEM_PROMPT: string = loadSystemPromptText();

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

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
      // workflowJson,
    }: {
      messages: UIMessage[];
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
    const mcpTools = await mcpClient.tools();

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
    try {
      result = streamText({
        model: openrouter(model || "openai/gpt-5"),
        messages: convertToModelMessages(messages),
        experimental_transform: smoothStream({
          delayInMs: 20, // optional: defaults to 10ms
          chunking: "word", // optional: defaults to 'word'
        }),
        // toolChoice: "required",
        tools, // Include tools for all models
        system: SYSTEM_PROMPT,
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
          system: SYSTEM_PROMPT,
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

serve(
  {
    fetch: app.fetch,
    port: 5000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
