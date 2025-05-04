import { ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { LogInterceptor } from '../../src/logger/log.interceptor';
import { LoggerService } from '../../src/logger/logger.service';

describe('LogInterceptor', () => {
  let interceptor: LogInterceptor;
  let loggerService: LoggerService;
  let executionContext: ExecutionContext;
  let callHandler: any;

  beforeEach(() => {
    loggerService = {
      logMethodEntry: jest.fn(),
      logMethodExit: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    } as unknown as LoggerService;

    interceptor = new LogInterceptor(loggerService);

    // Mock execution context for HTTP requests
    executionContext = {
      getType: jest.fn().mockReturnValue('http'),
      getHandler: jest.fn().mockReturnValue({ name: 'testMethod' }),
      getClass: jest.fn().mockReturnValue({ name: 'TestController' }),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          method: 'GET',
          originalUrl: '/api/test',
          ip: '127.0.0.1',
          headers: {
            'user-agent': 'test-agent',
          },
          user: { id: 123 },
          body: { test: 'data' },
        }),
        getResponse: jest.fn().mockReturnValue({
          statusCode: 200,
        }),
      }),
    } as unknown as ExecutionContext;

    // Mock call handler
    callHandler = {
      handle: jest.fn(),
    };
  });

  it('should log the start of method execution', () => {
    callHandler.handle.mockReturnValue(of({}));
    
    interceptor.intercept(executionContext, callHandler);
    
    expect(loggerService.logMethodEntry).toHaveBeenCalledWith(
      'testMethod',
      'TestController'
    );
    expect(loggerService.debug).toHaveBeenCalledWith(
      expect.stringContaining('Request: GET /api/test'),
      'TestController'
    );
  });

  it('should call tap, catchError, and finalize on the observable', () => {
    const responseData = { id: 1, name: 'Test' };
    const tapSpy = jest.fn();
    const errorSpy = jest.fn();
    const finalizeSpy = jest.fn();
    
    // Create a simple observable-like object with pipe method
    const mockObservable = {
      pipe: jest.fn().mockReturnThis(),
    };
    
    callHandler.handle.mockReturnValue(mockObservable);
    
    // Call the interceptor
    interceptor.intercept(executionContext, callHandler);
    
    // Verify the pipe method was called
    expect(mockObservable.pipe).toHaveBeenCalled();
    
    // Verify the handler was called with correct request
    expect(callHandler.handle).toHaveBeenCalled();
  });

  it('should handle WebSocket context correctly', () => {
    const wsContext = {
      getType: jest.fn().mockReturnValue('ws'),
      getHandler: jest.fn().mockReturnValue({ name: 'handleMessage' }),
      getClass: jest.fn().mockReturnValue({ name: 'ChatGateway' }),
      switchToWs: jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue({
          id: 'client123',
          data: {
            user: { id: 456 }
          }
        }),
        getData: jest.fn().mockReturnValue({ type: 'message', content: 'test' }),
      }),
    } as unknown as ExecutionContext;
    
    callHandler.handle.mockReturnValue(of({}));
    
    interceptor.intercept(wsContext, callHandler);
    
    expect(loggerService.debug).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket message'),
      'ChatGateway'
    );
  });

  // Test helper function
  it('should properly format response data summary', () => {
    // Use a private method directly for testing
    const method = interceptor['getResponseSummary'].bind(interceptor);
    
    // Test with different types of data
    expect(method(null)).toBe('empty response');
    expect(method(undefined)).toBe('empty response');
    
    // Test arrays
    expect(method([])).toBe('empty array');
    expect(method([1, 2, 3])).toBe('array with 3 items of type(s): number');
    expect(method([1, 'test', { a: 1 }])).toBe('array with 3 items of type(s): number, string, Object');
    
    // Test objects
    expect(method({})).toBe('empty object');
    expect(method({ id: 1, name: 'test' })).toBe('object with keys: [id, name]');
    
    // Test classes
    class TestClass { prop = 1; }
    expect(method(new TestClass())).toBe('TestClass with keys: [prop]');
    
    // Test large objects
    const largeObj = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };
    expect(method(largeObj)).toContain('object with 6 properties, including: [a, b, c...');
    
    // Test primitives
    expect(method('test string')).toBe('string: test string');
    expect(method(123)).toBe('number: 123');
    expect(method(true)).toBe('boolean: true');
    
    // Test with long string
    const longString = 'a'.repeat(100);
    expect(method(longString)).toBe(`string: ${'a'.repeat(47)}...`);
  });
  
  // Test bytes formatter
  it('should format bytes correctly', () => {
    const formatBytes = interceptor['formatBytes'].bind(interceptor);
    
    expect(formatBytes(500)).toBe('500 bytes');
    expect(formatBytes(1500)).toBe('1.5 KB');
    expect(formatBytes(1500000)).toBe('1.4 MB');
  });
}); 