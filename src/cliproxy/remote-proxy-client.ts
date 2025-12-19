/**
 * Remote Proxy Client for CLIProxyAPI
 *
 * HTTP client for health checks and connection testing against remote CLIProxyAPI instances.
 * Uses native fetch API with aggressive timeout for CLI responsiveness.
 */

import * as https from 'https';

/** Error codes for remote proxy status */
export type RemoteProxyErrorCode = 'CONNECTION_REFUSED' | 'TIMEOUT' | 'AUTH_FAILED' | 'UNKNOWN';

/** Status returned from remote proxy health check */
export interface RemoteProxyStatus {
  /** Whether the remote proxy is reachable */
  reachable: boolean;
  /** Latency in milliseconds (only set if reachable) */
  latencyMs?: number;
  /** Error message (only set if not reachable) */
  error?: string;
  /** Error code for programmatic handling */
  errorCode?: RemoteProxyErrorCode;
}

/** Configuration for remote proxy client */
export interface RemoteProxyClientConfig {
  /** Remote proxy host (IP or hostname) */
  host: string;
  /**
   * Remote proxy port.
   * Optional - defaults based on protocol:
   * - HTTPS: 443
   * - HTTP: 80
   */
  port?: number;
  /** Protocol to use (http or https) */
  protocol: 'http' | 'https';
  /** Optional auth token for Authorization header */
  authToken?: string;
  /** Request timeout in ms (default: 2000) */
  timeout?: number;
  /** Allow self-signed certificates (default: false) */
  allowSelfSigned?: boolean;
}

/** Default timeout for remote proxy requests (aggressive for CLI UX) */
const DEFAULT_TIMEOUT_MS = 2000;

/**
 * Get default port for protocol
 */
function getDefaultPort(protocol: 'http' | 'https'): number {
  return protocol === 'https' ? 443 : 80;
}

/**
 * Build URL for remote proxy, intelligently omitting default ports
 */
function buildProxyUrl(
  host: string,
  port: number | undefined,
  protocol: 'http' | 'https',
  path: string
): string {
  const defaultPort = getDefaultPort(protocol);
  const effectivePort = port ?? defaultPort;

  // Omit port from URL if it matches the default for the protocol
  if (effectivePort === defaultPort) {
    return `${protocol}://${host}${path}`;
  }
  return `${protocol}://${host}:${effectivePort}${path}`;
}

/**
 * Map error to RemoteProxyErrorCode
 *
 * Handles various error types including:
 * - NodeJS.ErrnoException (ECONNREFUSED, ETIMEDOUT)
 * - Fetch errors (AbortError, TypeError)
 * - HTTP status codes (401, 403)
 */
function mapErrorToCode(error: Error, statusCode?: number): RemoteProxyErrorCode {
  const message = error.message.toLowerCase();
  // Handle error.code safely - it may be string, number, or undefined
  const rawCode = (error as NodeJS.ErrnoException).code;
  const code = typeof rawCode === 'string' ? rawCode.toLowerCase() : undefined;

  // Connection refused
  if (code === 'econnrefused' || message.includes('connection refused')) {
    return 'CONNECTION_REFUSED';
  }

  // Timeout
  if (
    code === 'etimedout' ||
    code === 'timeout' ||
    message.includes('timeout') ||
    message.includes('aborted')
  ) {
    return 'TIMEOUT';
  }

  // Auth failed (401/403)
  if (statusCode === 401 || statusCode === 403) {
    return 'AUTH_FAILED';
  }

  return 'UNKNOWN';
}

/**
 * Get human-readable error message from error code
 */
function getErrorMessage(errorCode: RemoteProxyErrorCode, rawError?: string): string {
  switch (errorCode) {
    case 'CONNECTION_REFUSED':
      return 'Connection refused - is the proxy running?';
    case 'TIMEOUT':
      return 'Connection timed out';
    case 'AUTH_FAILED':
      return 'Authentication failed - check auth token';
    default:
      return rawError || 'Unknown error';
  }
}

/**
 * Create a custom HTTPS agent for self-signed certificate support
 */
function createHttpsAgent(allowSelfSigned: boolean): https.Agent | undefined {
  if (!allowSelfSigned) return undefined;

  return new https.Agent({
    rejectUnauthorized: false,
  });
}

/**
 * Check health of remote CLIProxyAPI instance
 *
 * @param config Remote proxy client configuration
 * @returns RemoteProxyStatus with reachability and latency
 */
export async function checkRemoteProxy(
  config: RemoteProxyClientConfig
): Promise<RemoteProxyStatus> {
  const { host, port, protocol, authToken, allowSelfSigned = false } = config;
  const timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;

  // Validate host is provided
  if (!host || host.trim() === '') {
    return {
      reachable: false,
      error: 'Host is required',
      errorCode: 'UNKNOWN',
    };
  }

  // Use smart URL building - omit port if it's the default for the protocol
  const url = buildProxyUrl(host, port, protocol, '/health');
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Build request options
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // For HTTPS with self-signed certs, we need to use native https module
    // Bun's fetch doesn't support custom agents
    let response: Response;

    if (protocol === 'https' && allowSelfSigned) {
      // Warn about security implications
      console.error('[!] Allowing self-signed certificate - not recommended for production');

      // Use native https module for self-signed cert support
      response = await new Promise<Response>((resolve, reject) => {
        const agent = createHttpsAgent(true);
        const reqTimeout = setTimeout(() => {
          reject(new Error('Request timeout'));
        }, timeout);

        const req = https.request(
          url,
          {
            method: 'GET',
            headers,
            agent,
            timeout,
          },
          (res) => {
            clearTimeout(reqTimeout);
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              resolve(
                new Response(data, {
                  status: res.statusCode || 500,
                  statusText: res.statusMessage,
                })
              );
            });
          }
        );

        req.on('error', (err) => {
          clearTimeout(reqTimeout);
          reject(err);
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.end();
      });
    } else {
      // Standard fetch for HTTP or HTTPS without self-signed
      response = await fetch(url, {
        signal: controller.signal,
        headers,
      });
    }

    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    // Check for auth failure
    if (response.status === 401 || response.status === 403) {
      return {
        reachable: false,
        error: getErrorMessage('AUTH_FAILED'),
        errorCode: 'AUTH_FAILED',
      };
    }

    // 200 OK = healthy
    if (response.ok) {
      return {
        reachable: true,
        latencyMs,
      };
    }

    // Non-200 but connected
    return {
      reachable: false,
      error: `Unexpected status: ${response.status}`,
      errorCode: 'UNKNOWN',
    };
  } catch (error) {
    const err = error as Error;
    const errorCode = mapErrorToCode(err);

    return {
      reachable: false,
      error: getErrorMessage(errorCode, err.message),
      errorCode,
    };
  }
}

/**
 * Test connection to remote CLIProxyAPI (alias for dashboard use)
 *
 * This is an alias for checkRemoteProxy() for semantic clarity in UI contexts.
 *
 * @param config Remote proxy client configuration
 * @returns RemoteProxyStatus with reachability and latency
 */
export async function testConnection(config: RemoteProxyClientConfig): Promise<RemoteProxyStatus> {
  return checkRemoteProxy(config);
}
