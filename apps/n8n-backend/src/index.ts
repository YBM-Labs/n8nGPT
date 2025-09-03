import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {
  convertToModelMessages,
  smoothStream,
  streamText,
  experimental_createMCPClient,
  type UIMessage,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { cors } from "hono/cors";
import { z } from "zod";

import { env } from "hono/adapter";
import dotenv from "dotenv";
import { auth } from "./lib/auth.js";
import { getGenerations, incrementGenerations } from "./lib/generations.js";
import { loadSystemPromptText } from "./utils/helperFunctions.js";
dotenv.config();

const app = new Hono();
const mcpClient = await experimental_createMCPClient({
  transport: {
    type: "sse",
    url: "https://mcp.context7.com/sse",
  },
});
// better-auth routes
app.all("/api/auth/**", async (c) => {
  return auth.handler(c.req.raw);
});

const EXTENSION_IDS = ["chrome-extension://hfahcogmfllljipnnlehfnpgimfldnie"];
const ALLOWED_ORIGINS = ["http://localhost:5000", ...EXTENSION_IDS];
app.use(
  "/*",
  cors({
    origin: (origin) =>
      origin && ALLOWED_ORIGINS.includes(origin) ? origin : "",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    exposeHeaders: ["Set-Cookie"],
    maxAge: 86400,
  })
);

// Load once at startup to avoid reading from disk on every request
const SYSTEM_PROMPT: string = loadSystemPromptText();

app.post("/", async (c) => {
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

  const { OPENROUTER_API_KEY } = env<{ OPENROUTER_API_KEY: string }>(c);
  const openrouter = createOpenRouter({
    apiKey: OPENROUTER_API_KEY,
  });

  try {
    const { messages, model }: { messages: UIMessage[]; model?: string } =
      await c.req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json(
        { error: "Messages array is required and cannot be empty" },
        400
      );
    }
    const mcpTools = await mcpClient.tools();
    const result = streamText({
      model: openrouter(model || "openai/gpt-5"),
      messages: convertToModelMessages(messages),
      experimental_transform: smoothStream({
        delayInMs: 20, // optional: defaults to 10ms
        chunking: "word", // optional: defaults to 'word'
      }),
      tools: {
        paste_json_in_n8n: {
          description: "Paste the JSON in n8n.",
          inputSchema: z.object({
            json: z.string().describe("The JSON to paste in n8n."),
          }) as any,
        },
        ...mcpTools,
      },
      system: SYSTEM_PROMPT,
    });

    c.header("Content-Type", "text/plain; charset=utf-8");

    await incrementGenerations(session.user.id);

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Error processing request:", error);
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
function createMCPClient(arg0: { transport: { type: string; url: string } }) {
  throw new Error("Function not implemented.");
}
