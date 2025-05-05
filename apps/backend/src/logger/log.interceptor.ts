import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { catchError, finalize, Observable, tap } from "rxjs";
import { LoggerService } from "./logger.service";

interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  method: string;
  path: string;
  className: string;
  methodName: string;
  status?: "success" | "error";
  httpStatus?: number;
  responseSize?: number;
  userId?: number;
}

@Injectable()
export class LogInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const startTime = Date.now();
    const methodName = context.getHandler().name;
    const className = context.getClass().name;

    // Initialize performance metrics
    const metrics: PerformanceMetrics = {
      startTime,
      method: "UNKNOWN",
      path: "UNKNOWN",
      className,
      methodName,
    };

    // Process request context and log request info
    const requestInfo = this.logRequest(context, metrics);

    // Log method entry
    this.logger.logMethodEntry(methodName, className);

    return next.handle().pipe(
      tap((data) => {
        // Log successful response
        this.logResponse(context, data, metrics);
      }),
      catchError((error: unknown) => {
        // Log error
        this.logError(context, error, requestInfo, metrics);
        throw error;
      }),
      finalize(() => {
        // Log performance and completion
        this.logCompletion(requestInfo, metrics);
      }),
    );
  }

  /**
   * Logs the incoming request details
   */
  private logRequest(
    context: ExecutionContext,
    metrics: PerformanceMetrics,
  ): string {
    // Get context type and initialize request info
    const contextType = context.getType();
    let requestInfo = "";

    if (contextType === "http") {
      // Handle HTTP requests
      const request = context.switchToHttp().getRequest();
      const { ip, method, originalUrl, body } = request;
      const userAgent = request.headers["user-agent"] || "unknown";

      requestInfo = `${method} ${originalUrl} from ${ip}`;
      metrics.method = method;
      metrics.path = originalUrl;

      // Track authenticated user if available
      if (request.user) {
        metrics.userId = request.user.id;
        this.logger.debug(
          `Authenticated request from user ${request.user.id}`,
          metrics.className,
        );
      }

      // Log request details with appropriate body redaction for sensitive routes
      const shouldRedactBody =
        originalUrl.includes("/auth/") ||
        originalUrl.includes("/password") ||
        originalUrl.includes("/login");

      const logBody = shouldRedactBody
        ? "{ ...redacted... }"
        : JSON.stringify(body).substring(0, 200);

      this.logger.debug(`Request: ${requestInfo}`, metrics.className);
      if (body && Object.keys(body).length > 0) {
        this.logger.debug(`Request body: ${logBody}`, metrics.className);
      }
    } else if (contextType === "ws") {
      // Handle WebSocket requests
      const client = context.switchToWs().getClient();
      const data = context.switchToWs().getData();

      requestInfo = `WS:${metrics.methodName}`;
      metrics.method = "WS";
      metrics.path = metrics.methodName;

      // Track user ID if available in socket data
      if (client.data && client.data.user) {
        metrics.userId = client.data.user.id;
      }

      // Log client and message info without sensitive data
      const clientInfo = client.id ? `client:${client.id}` : "unknown client";
      const dataInfo = data
        ? `event with data of type ${typeof data}`
        : "no data";

      this.logger.debug(
        `WebSocket message: ${metrics.methodName} from ${clientInfo} with ${dataInfo}`,
        metrics.className,
      );
    } else if (contextType === "rpc") {
      // Handle GraphQL/RPC requests if applicable
      requestInfo = `RPC:${metrics.methodName}`;
      metrics.method = "RPC";
      metrics.path = metrics.methodName;
      this.logger.debug(
        `RPC operation: ${metrics.methodName}`,
        metrics.className,
      );
    } else {
      requestInfo = `${contextType}:${metrics.methodName}`;
      metrics.method = contextType;
      metrics.path = metrics.methodName;
      this.logger.debug(
        `Request: ${contextType} ${metrics.methodName}`,
        metrics.className,
      );
    }

    return requestInfo;
  }

  /**
   * Logs the response data
   */
  private logResponse(
    context: ExecutionContext,
    data: any,
    metrics: PerformanceMetrics,
  ): void {
    // Log successful response summary
    const responseInfo = this.getResponseSummary(data);
    metrics.status = "success";

    // Capture HTTP response status if available
    if (context.getType() === "http") {
      const response = context.switchToHttp().getResponse();
      metrics.httpStatus = response.statusCode;

      // Estimate response size
      if (data) {
        try {
          const jsonData = JSON.stringify(data);
          metrics.responseSize = jsonData.length;
        } catch (e) {
          // Can't stringify response, that's fine
        }
      }
    }

    this.logger.debug(
      `Response for ${metrics.methodName}: ${responseInfo}`,
      metrics.className,
    );
  }

  /**
   * Logs error information
   */
  private logError(
    context: ExecutionContext,
    error: unknown,
    requestInfo: string,
    metrics: PerformanceMetrics,
  ): void {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    metrics.status = "error";

    // Set HTTP status from error if available
    if (error && typeof error === "object" && "status" in error) {
      metrics.httpStatus = Number(error.status);
    } else if (error && typeof error === "object" && "statusCode" in error) {
      metrics.httpStatus = Number(error.statusCode);
    }

    // Include request information in error logs
    this.logger.error(
      `Error in ${metrics.methodName} [${requestInfo}]: ${errorMessage}`,
      errorStack,
      metrics.className,
    );
  }

  /**
   * Logs completion and performance metrics
   */
  private logCompletion(
    requestInfo: string,
    metrics: PerformanceMetrics,
  ): void {
    const endTime = Date.now();
    const duration = endTime - metrics.startTime;

    // Update metrics
    metrics.endTime = endTime;
    metrics.duration = duration;

    this.logger.logMethodExit(metrics.methodName, duration, metrics.className);

    // Log structured performance metrics
    let performanceLog = `Performance: ${metrics.method} ${metrics.path} `;
    performanceLog += metrics.status === "success" ? "completed" : "failed";
    performanceLog += ` in ${duration}ms`;

    // Add HTTP status if available
    if (metrics.httpStatus) {
      performanceLog += ` with status ${metrics.httpStatus}`;
    }

    // Add response size if available
    if (metrics.responseSize) {
      performanceLog += ` (size: ${this.formatBytes(metrics.responseSize)})`;
    }

    // Add user context if available
    if (metrics.userId) {
      performanceLog += ` for user ${metrics.userId}`;
    }

    this.logger.debug(performanceLog, metrics.className);

    // Log completion with time info
    this.logger.debug(
      `Completed ${requestInfo} in ${duration}ms`,
      metrics.className,
    );
  }

  /**
   * Creates a brief summary of response data for logging
   */
  private getResponseSummary(data: any): string {
    if (!data) return "empty response";

    try {
      if (typeof data === "object") {
        // For arrays, log count and type sample
        if (Array.isArray(data)) {
          if (data.length === 0) return "empty array";

          // Sample the first few items' types
          const sampleSize = Math.min(3, data.length);
          const types = new Set<string>();

          for (let i = 0; i < sampleSize; i++) {
            const item = data[i];
            types.add(
              Array.isArray(item)
                ? "array"
                : item === null
                ? "null"
                : typeof item === "object"
                ? item.constructor?.name || "object"
                : typeof item,
            );
          }

          const typeString = Array.from(types).join(", ");
          return `array with ${data.length} items of type(s): ${typeString}`;
        }

        // Handle circular references and complex objects
        try {
          // Try to extract constructor name for class instances
          const typeName =
            data.constructor && data.constructor !== Object
              ? data.constructor.name
              : "object";

          // For objects, log keys or a subset
          const keys = Object.keys(data);
          if (keys.length === 0) return `empty ${typeName}`;

          if (keys.length <= 5) {
            return `${typeName} with keys: [${keys.join(", ")}]`;
          } else {
            // For larger objects, show sample keys
            const sampleKeys = keys.slice(0, 3);
            return `${typeName} with ${
              keys.length
            } properties, including: [${sampleKeys.join(", ")}...]`;
          }
        } catch (e) {
          // Fallback for objects with issues
          return "complex object (unable to enumerate properties)";
        }
      }

      // For primitive values
      const stringValue = String(data);
      const truncatedValue =
        stringValue.length > 50
          ? `${stringValue.substring(0, 47)}...`
          : stringValue;

      return `${typeof data}: ${truncatedValue}`;
    } catch (e) {
      return `unprocessable response data (${
        e instanceof Error ? e.message : "unknown error"
      })`;
    }
  }

  /**
   * Format bytes to a human-readable string (KB, MB, etc.)
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  }
}
