/**
 * Creates a mock LoggerService for testing
 * @returns A mock implementation of LoggerService with jest mock functions
 */
export const createMockLoggerService = () => {
  // Create base mock methods
  const mockMethods = {
    log: jest.fn().mockReturnThis(),
    error: jest.fn().mockReturnThis(),
    warn: jest.fn().mockReturnThis(),
    debug: jest.fn().mockReturnThis(),
    verbose: jest.fn().mockReturnThis(),
    logMethodEntry: jest.fn().mockReturnThis(),
    logMethodExit: jest.fn().mockReturnThis(),
    logDatabase: jest.fn().mockReturnThis(),
  };

  // Add methods to silence Winston logger
  Object.defineProperty(mockMethods, "child", {
    value: jest.fn().mockReturnThis(),
    configurable: true,
  });

  return mockMethods;
};
