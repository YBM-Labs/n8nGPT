export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  error?: Error;
}

class Logger {
  private logLevel: LogLevel = LogLevel.INFO;

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const prefix = `[${timestamp}] [${levelName}] [n8nGPT]`;

    if (context || error) {
      const extra = {
        ...(context && { context }),
        ...(error && { error: error.message, stack: error.stack }),
      };
      console.log(`${prefix} ${message}`, extra);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.formatMessage(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.formatMessage(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.formatMessage(LogLevel.WARN, message, context, error);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.formatMessage(LogLevel.ERROR, message, context, error);
  }

  // Convenience methods for common operations
  n8nOperation(operation: string, success: boolean, details?: Record<string, unknown>): void {
    const message = `N8n operation ${operation} ${success ? "succeeded" : "failed"}`;
    if (success) {
      this.info(message, details);
    } else {
      this.error(message, undefined, details);
    }
  }

  toolCall(toolName: string, success: boolean, error?: Error): void {
    const message = `Tool call ${toolName} ${success ? "completed" : "failed"}`;
    if (success) {
      this.info(message);
    } else {
      this.error(message, error);
    }
  }

  chatError(error: Error, context?: Record<string, unknown>): void {
    this.error("Chat operation failed", error, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Set log level based on environment
if (import.meta.env.DEV) {
  logger.setLogLevel(LogLevel.DEBUG);
} else {
  logger.setLogLevel(LogLevel.WARN);
}