/**
 * Direct mock for LoggerService to be used in individual tests
 */
export const mockLoggerService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  logMethodEntry: jest.fn(),
  logMethodExit: jest.fn(),
  logDatabase: jest.fn(),
};
