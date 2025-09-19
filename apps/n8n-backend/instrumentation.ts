import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import dotenv from "dotenv";
dotenv.config();

const sdk = new NodeSDK({
  spanProcessors: [
    new LangfuseSpanProcessor({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL,
    }),
  ],
});

sdk.start();

const shutdown = async (signal: string): Promise<void> => {
  try {
    await sdk.shutdown();
  } catch (error) {
    const message: string =
      error instanceof Error ? error.message : "Unknown error";
    // eslint-disable-next-line no-console
    console.error(
      `Error during OpenTelemetry SDK shutdown (${signal}): ${message}`
    );
  } finally {
    process.exit(0);
  }
};

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
