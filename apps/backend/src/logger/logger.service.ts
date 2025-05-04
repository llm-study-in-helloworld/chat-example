import { Inject, Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {}

  log(message: string, context?: string): void {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, { context });
  }

  /**
   * Logs the start of a method for tracing
   * @param methodName The name of the method
   * @param context The class or module context
   */
  logMethodEntry(methodName: string, context?: string): void {
    this.debug(`Entering method: ${methodName}`, context);
  }

  /**
   * Logs the end of a method for tracing
   * @param methodName The name of the method
   * @param timeMs Optional execution time in milliseconds
   * @param context The class or module context
   */
  logMethodExit(methodName: string, timeMs?: number, context?: string): void {
    const message = timeMs
      ? `Exiting method: ${methodName} (took ${timeMs}ms)`
      : `Exiting method: ${methodName}`;
    this.debug(message, context);
  }

  /**
   * Logs a database operation
   * @param operation The operation type
   * @param entity The entity being operated on
   * @param details Additional details
   * @param context The class or module context
   */
  logDatabase(operation: string, entity: string, details?: any, context?: string): void {
    this.debug(`DB ${operation} - ${entity}`, context);
    if (details) {
      this.debug(`Details: ${JSON.stringify(details)}`, context);
    }
  }
} 