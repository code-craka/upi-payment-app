// Global test setup
import { jest } from '@jest/globals';

// Mock console to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Mock setTimeout for tests that need timing control
global.setTimeout = jest.fn((callback, delay) => {
  // Immediately execute for testing
  if (typeof callback === 'function') {
    callback();
  }
  return 1; // Return a mock timer ID
}) as any;

// Mock performance.now() for consistent timing in tests
global.performance = {
  now: jest.fn(() => 1000), // Always return 1000ms for predictable tests
} as any;

// Setup fetch mock for Edge runtime compatibility tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  }),
) as any;

// Mock crypto for Edge runtime compatibility
global.crypto = {
  randomUUID: jest.fn(() => 'test-uuid-1234'),
  subtle: {} as any,
} as any;
