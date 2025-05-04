/**
 * Creates a mock LoggerService for testing
 * @returns A mock implementation of LoggerService with jest mock functions
 */
export const createMockLoggerService = () => {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    logMethodEntry: jest.fn(),
    logMethodExit: jest.fn(),
    logDatabase: jest.fn(),
  };
}; 