import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {
  convertToModelMessages,
  smoothStream,
  streamText,
  type UIMessage,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { cors } from "hono/cors";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "hono/adapter";
import dotenv from "dotenv";

dotenv.config();

const app = new Hono();

// Add CORS middleware
app.use("/*", cors());

/**
 * Resolve the absolute file system path to the repository root.
 * This is computed relative to the current module file path.
 */
function resolveProjectRootDirectory(): string {
  // Convert the module URL (e.g., file:///...) into a regular file system path
  const currentModuleFilePath: string = fileURLToPath(import.meta.url);
  const currentModuleDirectory: string = dirname(currentModuleFilePath);
  // Project root is one level up from `src/`
  return resolve(currentModuleDirectory, "..");
}

/**
 * Load the system prompt content from `SYSTEM_PROMPT.txt` at the project root.
 * Provides a safe default if the file is missing, unreadable, or empty.
 */
function loadSystemPromptText(): string {
  try {
    const projectRootDirectory: string = resolveProjectRootDirectory();
    const systemPromptPath: string = resolve(
      projectRootDirectory,
      "SYSTEM_PROMPT.txt"
    );

    // Read as UTF-8 text and trim extraneous whitespace for cleaner prompts
    const promptText: string = readFileSync(systemPromptPath, {
      encoding: "utf-8",
    }).trim();

    if (promptText.length === 0) {
      console.warn(
        "SYSTEM_PROMPT.txt is empty. Falling back to a minimal default prompt."
      );
      return "You are an n8n workflow assistant. DONT TALK OR DO ANYTHING ELSE. ONLY n8n workflow related things.";
    }

    return promptText;
  } catch (readError) {
    console.error(
      "Unable to read SYSTEM_PROMPT.txt. Falling back to a minimal default prompt.",
      readError
    );
    return "You are an n8n workflow assistant. DONT TALK OR DO ANYTHING ELSE. ONLY n8n workflow related things.";
  }
}

// Load once at startup to avoid reading from disk on every request
const SYSTEM_PROMPT: string = loadSystemPromptText();

app.post("/", async (c) => {
  const { OPENROUTER_API_KEY } = env<{ OPENROUTER_API_KEY: string }>(c);
  const openrouter = createOpenRouter({
    apiKey: OPENROUTER_API_KEY,
  });

  try {
    const {
      messages,
      model,
      webSearch,
    }: { messages: UIMessage[]; model?: string; webSearch?: boolean } =
      await c.req.json();

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json(
        { error: "Messages array is required and cannot be empty" },
        400
      );
    }

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
      },
      // Use the repository's SYSTEM_PROMPT.txt content as the system prompt
      system: SYSTEM_PROMPT,
    });

    c.header("Content-Type", "text/plain; charset=utf-8");

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Error processing request:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
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
