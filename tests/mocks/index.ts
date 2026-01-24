/**
 * Mock Infrastructure
 *
 * Centralized test mocking utilities for CCS CLI.
 * Replaces real HTTP/HTTPS servers with instant mock responses.
 *
 * @example
 * import { mockFetch, restoreFetch, HEALTH_OK } from '../mocks';
 *
 * beforeEach(() => {
 *   mockFetch([{ url: /\/health/, response: { ok: true } }]);
 * });
 *
 * afterEach(() => restoreFetch());
 */

// Types
export type {
  HttpMethod,
  MockResponse,
  MockResponseBody,
  MockHttpServerConfig,
  MockFetchHandler,
  CapturedRequest,
  MockHttpServer,
  RouteKey,
} from './types';

// Mock HTTP Server
export { createMockHttpServer, createMockResponse } from './mock-http-server';

// Mock Fetch
export {
  mockFetch,
  restoreFetch,
  getCapturedFetchRequests,
  clearCapturedFetchRequests,
  isFetchMocked,
} from './mock-fetch';

// Preset Responses
export {
  // Health responses
  HEALTH_OK,
  HEALTH_FAIL,
  // Upload responses
  UPLOAD_SUCCESS,
  TOKEN_UPLOAD_OK,
  TOKEN_UPLOAD_CONFLICT,
  // Error responses
  UNAUTHORIZED,
  FORBIDDEN,
  NOT_FOUND,
  SERVER_ERROR,
  // Remote proxy responses
  REMOTE_PROXY_OK,
  REMOTE_PROXY_TIMEOUT,
  // Handler presets
  HEALTH_HANDLER,
  UPLOAD_HANDLER,
  MESSAGES_HANDLER,
  // Helper functions
  createDelayedResponse,
  createErrorResponse,
} from './fixtures/responses';
