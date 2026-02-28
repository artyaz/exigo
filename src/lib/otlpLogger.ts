import "server-only";

import { logs, SeverityNumber, type Logger } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";

type Primitive = string | number | boolean;
type AttributeValue = Primitive | Primitive[];
export type LogAttributes = Record<string, AttributeValue | undefined>;

const POSTHOG_OTLP_LOGS_URL =
  process.env.POSTHOG_OTLP_URL ??
  `https://${process.env.POSTHOG_REGION === "eu" ? "eu" : "us"}.i.posthog.com/i/v1/logs`;
const LOGGER_NAME = "exigo.server";

let initialized = false;
let loggerInstance: Logger | null = null;
let didWarnMissingToken = false;

function getServiceVersion(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.npm_package_version ??
    "0.1.0"
  );
}

function getDeploymentEnvironment(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

function sanitizeAttributes(
  attributes: LogAttributes | undefined,
): Record<string, AttributeValue> {
  if (!attributes) return {};
  const cleaned: Record<string, AttributeValue> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export function registerOtelLogger(): void {
  if (initialized) return;

  const token =
    process.env.POSTHOG_PROJECT_TOKEN ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!token) {
    if (!didWarnMissingToken) {
      didWarnMissingToken = true;
      console.warn(
        "OTLP logging is disabled: missing POSTHOG_PROJECT_TOKEN (or NEXT_PUBLIC_POSTHOG_KEY fallback).",
      );
    }
    initialized = true;
    return;
  }

  const resource = resourceFromAttributes({
    "service.name": process.env.OTEL_SERVICE_NAME ?? "exigo-next-app",
    "service.version": getServiceVersion(),
    "deployment.environment": getDeploymentEnvironment(),
  });

  try {
    const exporter = new OTLPLogExporter({
      url: POSTHOG_OTLP_LOGS_URL,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const provider = new LoggerProvider({
      resource,
      processors: [new BatchLogRecordProcessor(exporter)],
    });
    logs.setGlobalLoggerProvider(provider);
    loggerInstance = logs.getLogger(LOGGER_NAME);
  } catch (initError) {
    console.error("Failed to initialize OTLP logger:", initError);
  }
  initialized = true;
}

function getLogger(): Logger | null {
  if (!initialized) {
    registerOtelLogger();
  }
  return loggerInstance;
}

function emitLog(
  severityText: "DEBUG" | "INFO" | "WARN" | "ERROR",
  severityNumber: SeverityNumber,
  body: string,
  attributes?: LogAttributes,
): void {
  const logger = getLogger();
  if (!logger) return;

  logger.emit({
    severityText,
    severityNumber,
    body,
    attributes: sanitizeAttributes(attributes),
  });
}

export function logDebug(body: string, attributes?: LogAttributes): void {
  emitLog("DEBUG", SeverityNumber.DEBUG, body, attributes);
}

export function logInfo(body: string, attributes?: LogAttributes): void {
  emitLog("INFO", SeverityNumber.INFO, body, attributes);
}

export function logWarn(body: string, attributes?: LogAttributes): void {
  emitLog("WARN", SeverityNumber.WARN, body, attributes);
}

export function logError(body: string, attributes?: LogAttributes): void {
  emitLog("ERROR", SeverityNumber.ERROR, body, attributes);
}

type HeaderReader = { get: (name: string) => string | null };

export function createRequestId(headers?: HeaderReader): string {
  return (
    headers?.get("x-request-id") ??
    headers?.get("x-correlation-id") ??
    crypto.randomUUID()
  );
}

export function getErrorAttributes(error: unknown): LogAttributes {
  if (error instanceof Error) {
    return {
      "error.name": error.name,
      "error.message": error.message,
      "error.stack": error.stack,
    };
  }

  return {
    "error.message": String(error),
  };
}
