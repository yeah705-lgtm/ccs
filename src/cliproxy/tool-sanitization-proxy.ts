/**
 * Tool Sanitization Proxy
 *
 * HTTP proxy that intercepts Claude CLI → CLIProxy requests to:
 * 1. Sanitize MCP tool names exceeding Gemini's 64-char limit
 * 2. Forward sanitized requests to upstream
 * 3. Restore original names in responses
 *
 * Follows CodexReasoningProxy pattern for consistency.
 */

import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { ToolNameMapper, type Tool, type ContentBlock } from './tool-name-mapper';

export interface ToolSanitizationProxyConfig {
  /** Upstream CLIProxy URL */
  upstreamBaseUrl: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Log warnings when sanitization occurs */
  warnOnSanitize?: boolean;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class ToolSanitizationProxy {
  private server: http.Server | null = null;
  private port: number | null = null;
  private readonly config: Required<ToolSanitizationProxyConfig>;

  constructor(config: ToolSanitizationProxyConfig) {
    this.config = {
      upstreamBaseUrl: config.upstreamBaseUrl,
      verbose: config.verbose ?? false,
      warnOnSanitize: config.warnOnSanitize ?? true,
      timeoutMs: config.timeoutMs ?? 120000,
    };
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.error(`[tool-sanitization-proxy] ${message}`);
    }
  }

  private warn(message: string): void {
    if (this.config.warnOnSanitize) {
      console.error(`[!] ${message}`);
    }
  }

  /**
   * Start the proxy server on an ephemeral port.
   * @returns The assigned port number
   */
  async start(): Promise<number> {
    if (this.server) return this.port ?? 0;

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        void this.handleRequest(req, res);
      });

      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server?.address();
        this.port = typeof address === 'object' && address ? address.port : 0;
        resolve(this.port);
      });

      this.server.on('error', (err) => reject(err));
    });
  }

  /**
   * Stop the proxy server.
   */
  stop(): void {
    if (!this.server) return;
    this.server.close();
    this.server = null;
    this.port = null;
  }

  /**
   * Get the port the proxy is listening on.
   */
  getPort(): number | null {
    return this.port;
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const maxSize = 10 * 1024 * 1024; // 10MB
      let total = 0;

      req.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxSize) {
          req.destroy();
          reject(new Error('Request body too large (max 10MB)'));
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = req.method || 'GET';
    const requestPath = req.url || '/';
    const upstreamBase = new URL(this.config.upstreamBaseUrl);
    const fullUpstreamUrl = new URL(requestPath, upstreamBase);

    this.log(`${method} ${requestPath} → ${fullUpstreamUrl.href}`);

    // Only buffer+rewrite JSON POST requests
    const contentType = String(req.headers['content-type'] || '');
    const isJson = contentType.includes('application/json');
    const shouldRewrite = isJson && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase());

    try {
      if (!shouldRewrite) {
        await this.forwardRaw(req, res, fullUpstreamUrl);
        return;
      }

      const rawBody = await this.readBody(req);
      let parsed: unknown;
      try {
        parsed = rawBody.length ? JSON.parse(rawBody) : {};
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
        return;
      }

      // Create mapper for this request
      const mapper = new ToolNameMapper();

      // Sanitize tools if present
      let modifiedBody = parsed;
      if (isRecord(parsed) && Array.isArray(parsed.tools)) {
        const sanitizedTools = mapper.registerTools(parsed.tools as Tool[]);
        modifiedBody = { ...parsed, tools: sanitizedTools };

        // Log sanitization warnings
        if (mapper.hasChanges()) {
          const changes = mapper.getChanges();
          for (const change of changes) {
            this.warn(`Tool name sanitized: "${change.original}" → "${change.sanitized}"`);
          }
          this.log(`Sanitized ${changes.length} tool name(s)`);
        }
      }

      // Check if streaming is requested
      const isStreaming = isRecord(parsed) && parsed.stream === true;

      if (isStreaming) {
        await this.forwardJsonStreaming(req, res, fullUpstreamUrl, modifiedBody, mapper);
      } else {
        await this.forwardJsonBuffered(req, res, fullUpstreamUrl, modifiedBody, mapper);
      }
    } catch (error) {
      const err = error as Error;
      this.log(`Error: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  private buildForwardHeaders(
    originalHeaders: http.IncomingHttpHeaders,
    bodyString?: string
  ): http.OutgoingHttpHeaders {
    const headers: http.OutgoingHttpHeaders = {};

    // RFC 7230 hop-by-hop headers that should not be forwarded
    const hopByHop = new Set([
      'host',
      'content-length',
      'connection',
      'transfer-encoding',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailer',
      'upgrade',
    ]);

    for (const [key, value] of Object.entries(originalHeaders)) {
      if (!value) continue;
      const lower = key.toLowerCase();
      if (hopByHop.has(lower)) continue;
      headers[key] = value;
    }

    if (bodyString !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    return headers;
  }

  private getRequestFn(url: URL): typeof http.request | typeof https.request {
    return url.protocol === 'https:' ? https.request : http.request;
  }

  private forwardRaw(
    originalReq: http.IncomingMessage,
    clientRes: http.ServerResponse,
    upstreamUrl: URL
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestFn = this.getRequestFn(upstreamUrl);
      const upstreamReq = requestFn(
        {
          protocol: upstreamUrl.protocol,
          hostname: upstreamUrl.hostname,
          port: upstreamUrl.port,
          path: upstreamUrl.pathname + upstreamUrl.search,
          method: originalReq.method,
          timeout: this.config.timeoutMs,
          headers: this.buildForwardHeaders(originalReq.headers),
        },
        (upstreamRes) => {
          clientRes.writeHead(upstreamRes.statusCode || 200, upstreamRes.headers);
          upstreamRes.pipe(clientRes);
          upstreamRes.on('end', () => resolve());
          upstreamRes.on('error', reject);
        }
      );

      upstreamReq.on('timeout', () => upstreamReq.destroy(new Error('Upstream request timeout')));
      upstreamReq.on('error', reject);
      originalReq.pipe(upstreamReq);
    });
  }

  /**
   * Forward JSON request and buffer response for tool name restoration.
   */
  private forwardJsonBuffered(
    originalReq: http.IncomingMessage,
    clientRes: http.ServerResponse,
    upstreamUrl: URL,
    body: unknown,
    mapper: ToolNameMapper
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const bodyString = JSON.stringify(body);
      const requestFn = this.getRequestFn(upstreamUrl);
      const upstreamReq = requestFn(
        {
          protocol: upstreamUrl.protocol,
          hostname: upstreamUrl.hostname,
          port: upstreamUrl.port,
          path: upstreamUrl.pathname + upstreamUrl.search,
          method: originalReq.method,
          timeout: this.config.timeoutMs,
          headers: this.buildForwardHeaders(originalReq.headers, bodyString),
        },
        (upstreamRes) => {
          const chunks: Buffer[] = [];

          upstreamRes.on('data', (chunk: Buffer) => chunks.push(chunk));
          upstreamRes.on('end', () => {
            try {
              const responseBody = Buffer.concat(chunks).toString('utf8');
              const contentType = upstreamRes.headers['content-type'] || '';

              // Only process JSON responses with tool_use blocks
              if (contentType.includes('application/json') && mapper.hasChanges()) {
                try {
                  const parsed = JSON.parse(responseBody);
                  if (isRecord(parsed) && Array.isArray(parsed.content)) {
                    parsed.content = mapper.restoreToolUse(parsed.content as ContentBlock[]);
                    const modifiedResponse = JSON.stringify(parsed);

                    // Update content-length header
                    const headers = { ...upstreamRes.headers };
                    headers['content-length'] = String(Buffer.byteLength(modifiedResponse));

                    clientRes.writeHead(upstreamRes.statusCode || 200, headers);
                    clientRes.end(modifiedResponse);
                    resolve();
                    return;
                  }
                } catch {
                  // JSON parse failed, pass through unchanged
                }
              }

              // Pass through unchanged
              clientRes.writeHead(upstreamRes.statusCode || 200, upstreamRes.headers);
              clientRes.end(responseBody);
              resolve();
            } catch (err) {
              reject(err);
            }
          });
          upstreamRes.on('error', reject);
        }
      );

      upstreamReq.on('timeout', () => upstreamReq.destroy(new Error('Upstream request timeout')));
      upstreamReq.on('error', reject);
      upstreamReq.write(bodyString);
      upstreamReq.end();
    });
  }

  /**
   * Forward JSON request and stream response with tool name restoration.
   * Handles SSE (Server-Sent Events) format.
   */
  private forwardJsonStreaming(
    originalReq: http.IncomingMessage,
    clientRes: http.ServerResponse,
    upstreamUrl: URL,
    body: unknown,
    mapper: ToolNameMapper
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const bodyString = JSON.stringify(body);
      const requestFn = this.getRequestFn(upstreamUrl);
      const upstreamReq = requestFn(
        {
          protocol: upstreamUrl.protocol,
          hostname: upstreamUrl.hostname,
          port: upstreamUrl.port,
          path: upstreamUrl.pathname + upstreamUrl.search,
          method: originalReq.method,
          timeout: this.config.timeoutMs,
          headers: this.buildForwardHeaders(originalReq.headers, bodyString),
        },
        (upstreamRes) => {
          clientRes.writeHead(upstreamRes.statusCode || 200, upstreamRes.headers);

          // If no changes were made, just pipe through
          if (!mapper.hasChanges()) {
            upstreamRes.pipe(clientRes);
            upstreamRes.on('end', () => resolve());
            upstreamRes.on('error', reject);
            return;
          }

          // Process SSE events for tool name restoration
          let buffer = '';

          upstreamRes.on('data', (chunk: Buffer) => {
            buffer += chunk.toString('utf8');

            // Process complete SSE events
            const events = buffer.split('\n\n');
            buffer = events.pop() || ''; // Keep incomplete event in buffer

            for (const event of events) {
              if (!event.trim()) continue;

              const processedEvent = this.processSSEEvent(event, mapper);
              clientRes.write(processedEvent + '\n\n');
            }
          });

          upstreamRes.on('end', () => {
            // Process any remaining buffer
            if (buffer.trim()) {
              const processedEvent = this.processSSEEvent(buffer, mapper);
              clientRes.write(processedEvent + '\n\n');
            }
            clientRes.end();
            resolve();
          });

          upstreamRes.on('error', reject);
        }
      );

      upstreamReq.on('timeout', () => upstreamReq.destroy(new Error('Upstream request timeout')));
      upstreamReq.on('error', reject);
      upstreamReq.write(bodyString);
      upstreamReq.end();
    });
  }

  /**
   * Process a single SSE event, restoring tool names if present.
   */
  private processSSEEvent(event: string, mapper: ToolNameMapper): string {
    // Parse SSE format: data: {...}
    const lines = event.split('\n');
    const processedLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6); // Remove 'data: ' prefix

        // Skip [DONE] marker
        if (jsonStr.trim() === '[DONE]') {
          processedLines.push(line);
          continue;
        }

        try {
          const data = JSON.parse(jsonStr);

          // Handle content_block_start with tool_use
          if (
            isRecord(data) &&
            data.type === 'content_block_start' &&
            isRecord(data.content_block) &&
            data.content_block.type === 'tool_use' &&
            typeof data.content_block.name === 'string'
          ) {
            const originalName = mapper.restoreName(data.content_block.name);
            data.content_block.name = originalName;
            processedLines.push('data: ' + JSON.stringify(data));
            continue;
          }

          // Handle message with content array (final message)
          if (isRecord(data) && Array.isArray(data.content)) {
            data.content = mapper.restoreToolUse(data.content as ContentBlock[]);
            processedLines.push('data: ' + JSON.stringify(data));
            continue;
          }

          // Pass through unchanged
          processedLines.push(line);
        } catch {
          // Not valid JSON, pass through unchanged
          processedLines.push(line);
        }
      } else {
        // Non-data lines (event:, id:, etc.) pass through
        processedLines.push(line);
      }
    }

    return processedLines.join('\n');
  }
}
