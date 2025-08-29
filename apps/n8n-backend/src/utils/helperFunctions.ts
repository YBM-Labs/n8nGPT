import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve the absolute file system path to the repository root.
 * This is computed relative to the current module file path.
 */
export function resolveProjectRootDirectory(): string {
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
export function loadSystemPromptText(): string {
  try {
    const projectRootDirectory: string = resolveProjectRootDirectory();
    const systemPromptPath: string = resolve(
      projectRootDirectory,
      "SYSTEM_PROMPT.txt"
    );

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
