// Set environment variables for testing
process.env.NODE_ENV = 'test';

// Configure MikroORM to use SQLite in-memory database
process.env.DB_TYPE = 'sqlite';
process.env.DB_URL = ':memory:';

// Mark as test environment
process.env.IS_E2E_TEST = 'true';

// This is useful for debugging purposes
console.log('E2E Tests - Using in-memory SQLite database'); 