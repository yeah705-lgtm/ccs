/**
 * AgyProxy - Response proxy for Antigravity model ID normalization and tool_use validation
 *
 * Architecture:
 * - Sits between Claude Code and CLIProxyAPI
 * - Forwards requests unchanged to upstream (after stripping unsupported fields)
 * - Intercepts responses and normalizes model IDs in message_start events
 * - Buffers tool_use inputs to ensure completeness before forwarding to Claude Code
 * - Fixes MCP tool failures caused by invalid model IDs and incomplete tool_use inputs
 *
 * Tool Use Validation:
 * - CLIProxyAPI may return tool_use with empty/incomplete inputs when translating
 *   from Gemini's function call format, especially with thinking models
 * - This proxy buffers input_json_delta chunks until content_block_stop
 * - Validates required parameters exist before forwarding to Claude Code
 * - Prevents "undefined is not an object (evaluating 'T.startsWith')" crashes
 *
 * Lifecycle:
 * - Spawned by cliproxy-executor when 'agy' provider detected
 * - Binds to 127.0.0.1:random_port (security + avoid conflicts)
 * - Terminates when parent process exits
 */

import * as http from 'http';
import * as https from 'https';

import { normalizeModelId } from './model-normalizer';

interface AgyProxyConfig {
  upstreamUrl: string;
  verbose?: boolean;
  timeout?: number;
}

/** Buffered tool_use block being accumulated from streaming deltas */
interface ToolUseBuffer {
  name: string;
  id: string;
  inputJson: string;
  startEvent: string; // Original content_block_start line (held until validated)
}

/** Required parameters for known tool types */
const REQUIRED_PARAMS: Record<string, string[]> = {
  Read: ['file_path'],
  Edit: ['file_path', 'old_string', 'new_string'],
  Write: ['file_path', 'content'],
  Glob: ['pattern'],
  Grep: ['pattern'],
  Bash: ['command'],
  Task: ['description', 'prompt', 'subagent_type'],
};

export class AgyProxy {
  private upstreamUrl: string;
  private server: http.Server | null = null;
  private port: number | null = null;
  private verbose: boolean;
  private timeout: number;

  /** Buffers for tool_use blocks being accumulated (keyed by content block index) */
  private toolUseBuffers: Map<number, ToolUseBuffer> = new Map();

  constructor(config: AgyProxyConfig) {
    this.upstreamUrl = config.upstreamUrl;
    this.verbose = config.verbose || false;
    this.timeout = config.timeout || 120000;
  }

  /**
   * Start HTTP server on random port
   */
  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server?.address();
        this.port = typeof address === 'object' && address ? address.port : 0;
        console.log(`PROXY_READY:${this.port}`);

        if (this.verbose) {
          console.error(
            `[agy-proxy] Listening on port ${this.port}, forwarding to ${this.upstreamUrl}`
          );
        }

        resolve(this.port);
      });

      this.server.on('error', (error) => {
        console.error('[agy-proxy] Server error:', error);
        reject(error);
      });
    });
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const startTime = Date.now();
    this.log(`Request: ${req.method} ${req.url}`);
    this.log(`Request headers: ${JSON.stringify(req.headers)}`);

    // Reset buffers for new request
    this.toolUseBuffers.clear();

    try {
      // Read request body
      const body = await this.readBody(req);

      // Transform request body to strip unsupported fields
      const transformedBody = this.transformRequestBody(body);

      // Determine if streaming based on Accept header or request body
      const isStreaming =
        req.headers.accept?.includes('text/event-stream') ||
        (body && body.includes('"stream":true'));

      // Forward request to upstream
      const upstreamUrl = new URL(req.url || '/', this.upstreamUrl);
      this.log(`Upstream URL: ${upstreamUrl.href}`);
      this.log(`Upstream path: ${upstreamUrl.pathname + upstreamUrl.search}`);
      const isHttps = upstreamUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      // Update content-length if body was transformed
      const headers = { ...req.headers, host: upstreamUrl.host };
      if (transformedBody !== body) {
        headers['content-length'] = Buffer.byteLength(transformedBody).toString();
      }

      const upstreamReq = httpModule.request(
        {
          hostname: upstreamUrl.hostname,
          port: upstreamUrl.port || (isHttps ? 443 : 80),
          path: upstreamUrl.pathname + upstreamUrl.search,
          method: req.method,
          headers,
          // Allow self-signed certs for remote proxy (common in dev environments)
          ...(isHttps ? { rejectUnauthorized: false } : {}),
        },
        (upstreamRes) => {
          if (isStreaming) {
            this.handleStreamingResponse(upstreamRes, res, startTime);
          } else {
            this.handleBufferedResponse(upstreamRes, res, startTime);
          }
        }
      );

      upstreamReq.on('error', (error) => {
        this.log(`Upstream error: ${error.message}`);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { type: 'proxy_error', message: error.message } }));
        }
      });

      // Set timeout
      upstreamReq.setTimeout(this.timeout, () => {
        upstreamReq.destroy();
        if (!res.headersSent) {
          res.writeHead(504, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { type: 'timeout_error', message: 'Request timeout' } }));
        }
      });

      if (transformedBody) {
        upstreamReq.write(transformedBody);
      }
      upstreamReq.end();
    } catch (error) {
      const err = error as Error;
      this.log(`Request error: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { type: 'proxy_error', message: err.message } }));
      }
    }
  }

  /**
   * Transform request body to strip fields unsupported by Antigravity/Gemini.
   * - Removes cache_control from thinking content blocks (causes 400 error)
   *
   * Handles multiple structures:
   * 1. { type: "thinking", cache_control: {...} } - top-level cache_control
   * 2. { thinking: { cache_control: {...} } } - nested thinking object
   */
  private transformRequestBody(body: string): string {
    if (!body) return body;

    try {
      const data = JSON.parse(body);

      // Transform messages array if present
      if (Array.isArray(data.messages)) {
        let modified = false;
        for (const message of data.messages) {
          if (Array.isArray(message.content)) {
            for (const block of message.content) {
              // Structure 1: { type: "thinking", cache_control: {...} }
              if (block.type === 'thinking' && block.cache_control !== undefined) {
                delete block.cache_control;
                modified = true;
                this.log('Stripped cache_control from thinking block (type=thinking)');
              }
              // Structure 2: { thinking: { cache_control: {...} } }
              if (block.thinking && typeof block.thinking === 'object') {
                if (block.thinking.cache_control !== undefined) {
                  delete block.thinking.cache_control;
                  modified = true;
                  this.log('Stripped cache_control from nested thinking object');
                }
              }
            }
          }
        }
        if (modified) {
          return JSON.stringify(data);
        }
      }

      return body;
    } catch (e) {
      // JSON parse failed, pass through unchanged
      this.log(`Request body parse failed: ${(e as Error).message}`);
      return body;
    }
  }

  /**
   * Handle streaming SSE response - transform model IDs and buffer tool_use inputs
   */
  private handleStreamingResponse(
    upstreamRes: http.IncomingMessage,
    clientRes: http.ServerResponse,
    startTime: number
  ): void {
    // Forward headers
    const headers: Record<string, string | string[] | undefined> = { ...upstreamRes.headers };
    clientRes.writeHead(upstreamRes.statusCode || 200, headers);

    // Disable Nagle for immediate flush
    if (clientRes.socket) {
      clientRes.socket.setNoDelay(true);
    }

    let buffer = '';

    upstreamRes.on('data', (chunk: Buffer) => {
      const data = chunk.toString();
      buffer += data;

      // Process complete SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const linesToEmit = this.processSSELine(line);
        for (const emitLine of linesToEmit) {
          clientRes.write(emitLine + '\n');
        }
      }
    });

    upstreamRes.on('end', () => {
      // Flush remaining buffer
      if (buffer) {
        const linesToEmit = this.processSSELine(buffer);
        for (const emitLine of linesToEmit) {
          clientRes.write(emitLine + '\n');
        }
      }
      clientRes.end();
      const duration = Date.now() - startTime;
      this.log(`Streaming completed in ${duration}ms`);
    });

    upstreamRes.on('error', (error) => {
      this.log(`Upstream stream error: ${error.message}`);
      clientRes.end();
    });
  }

  /**
   * Handle buffered (non-streaming) response - transform model ID in JSON
   */
  private handleBufferedResponse(
    upstreamRes: http.IncomingMessage,
    clientRes: http.ServerResponse,
    startTime: number
  ): void {
    const chunks: Buffer[] = [];

    upstreamRes.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    upstreamRes.on('end', () => {
      const body = Buffer.concat(chunks).toString();

      try {
        const data = JSON.parse(body);

        // Transform model field in response
        if (data.model) {
          const originalModel = data.model;
          data.model = normalizeModelId(data.model);
          if (originalModel !== data.model) {
            this.log(`Normalized model: ${originalModel} -> ${data.model}`);
          }
        }

        const transformed = JSON.stringify(data);
        const headers: Record<string, string | string[] | undefined> = { ...upstreamRes.headers };
        headers['content-length'] = Buffer.byteLength(transformed).toString();
        clientRes.writeHead(upstreamRes.statusCode || 200, headers);
        clientRes.end(transformed);
      } catch {
        // JSON parse failed, pass through unchanged
        clientRes.writeHead(upstreamRes.statusCode || 200, upstreamRes.headers);
        clientRes.end(body);
      }

      const duration = Date.now() - startTime;
      this.log(`Buffered response completed in ${duration}ms`);
    });

    upstreamRes.on('error', (error) => {
      this.log(`Upstream error: ${error.message}`);
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'application/json' });
        clientRes.end(JSON.stringify({ error: { type: 'proxy_error', message: error.message } }));
      }
    });
  }

  /**
   * Process a single SSE line - may return 0, 1, or multiple lines
   * Handles tool_use buffering to ensure complete inputs
   */
  private processSSELine(line: string): string[] {
    if (!line.startsWith('data: ')) {
      return [line];
    }

    const jsonStr = line.slice(6);
    if (!jsonStr || jsonStr === '[DONE]') {
      return [line];
    }

    try {
      const data = JSON.parse(jsonStr);

      // Log event type for debugging
      if (data.type) {
        this.log(`SSE event: ${data.type}`);
      }

      // Transform model in message_start event
      if (data.type === 'message_start' && data.message?.model) {
        const originalModel = data.message.model;
        this.log(`message_start model: ${originalModel}`);
        data.message.model = normalizeModelId(data.message.model);
        if (originalModel !== data.message.model) {
          this.log(`Normalized SSE model: ${originalModel} -> ${data.message.model}`);
        }
        return ['data: ' + JSON.stringify(data)];
      }

      // Buffer tool_use content_block_start
      if (data.type === 'content_block_start' && data.content_block?.type === 'tool_use') {
        const index = data.index;
        const toolName = data.content_block.name || '';
        const toolId = data.content_block.id || '';

        this.log(`Buffering tool_use start: index=${index}, name=${toolName}, id=${toolId}`);

        this.toolUseBuffers.set(index, {
          name: toolName,
          id: toolId,
          inputJson: '',
          startEvent: line,
        });

        // Don't emit yet - wait for complete input
        return [];
      }

      // Accumulate input_json_delta for buffered tool_use
      if (data.type === 'content_block_delta' && data.delta?.type === 'input_json_delta') {
        const index = data.index;
        const buffer = this.toolUseBuffers.get(index);

        if (buffer) {
          const partialJson = data.delta.partial_json || '';
          buffer.inputJson += partialJson;
          this.log(`Accumulated input_json_delta for index=${index}: +${partialJson.length} chars`);
          // Don't emit - continue buffering
          return [];
        }
      }

      // On content_block_stop, validate and emit buffered tool_use
      if (data.type === 'content_block_stop') {
        const index = data.index;
        const buffer = this.toolUseBuffers.get(index);

        if (buffer) {
          this.log(
            `Tool use complete: index=${index}, name=${buffer.name}, inputJson=${buffer.inputJson.length} chars`
          );

          // Validate the accumulated input
          const validation = this.validateToolInput(buffer.name, buffer.inputJson);

          if (validation.valid) {
            // Emit the held content_block_start with validated input
            const startData = JSON.parse(buffer.startEvent.slice(6));
            try {
              startData.content_block.input = JSON.parse(buffer.inputJson || '{}');
            } catch {
              startData.content_block.input = {};
            }

            this.toolUseBuffers.delete(index);

            // Return: start event (with input), then stop event
            return ['data: ' + JSON.stringify(startData), line];
          } else {
            // Invalid tool_use - emit warning and skip
            this.log(`[!] Invalid tool_use: ${validation.error}`);
            console.error(`[agy-proxy] Tool call incomplete: ${buffer.name}`);
            console.error(`[agy-proxy]   ${validation.error}`);
            console.error(
              `[agy-proxy]   This is a known issue with gemini-claude-*-thinking models.`
            );
            console.error(`[agy-proxy]   The model may retry or you can switch to a stable model.`);

            this.toolUseBuffers.delete(index);

            // Return error event instead of tool_use
            const errorData = {
              type: 'content_block_start',
              index,
              content_block: {
                type: 'text',
                text: `[Tool call failed: ${buffer.name} - ${validation.error}]`,
              },
            };
            return ['data: ' + JSON.stringify(errorData), line];
          }
        }
      }

      // Pass through other events unchanged
      return [line];
    } catch {
      // JSON parse failed, pass through unchanged
      return [line];
    }
  }

  /**
   * Validate tool_use input has required parameters
   */
  private validateToolInput(
    toolName: string,
    inputJson: string
  ): { valid: boolean; error?: string } {
    // Parse input JSON
    let input: Record<string, unknown>;
    try {
      input = JSON.parse(inputJson || '{}');
    } catch (e) {
      return { valid: false, error: `Invalid JSON: ${(e as Error).message}` };
    }

    // Check if input is empty
    if (Object.keys(input).length === 0) {
      return { valid: false, error: 'Empty input object' };
    }

    // Check required parameters for known tools
    const required = REQUIRED_PARAMS[toolName];
    if (required) {
      for (const param of required) {
        if (input[param] === undefined) {
          return { valid: false, error: `Missing required parameter: ${param}` };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Read request body with size limit
   */
  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const maxSize = 10 * 1024 * 1024; // 10MB limit
      let totalSize = 0;

      req.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          reject(new Error('Request body too large (max 10MB)'));
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.on('error', reject);
    });
  }

  /**
   * Stop proxy server
   */
  stop(): void {
    if (this.server) {
      this.log('Stopping proxy server');
      this.server.close();
      this.server = null;
    }
  }

  /**
   * Get the port the proxy is listening on
   */
  getPort(): number | null {
    return this.port;
  }

  /**
   * Log message if verbose mode enabled
   */
  private log(message: string): void {
    if (this.verbose) {
      console.error(`[agy-proxy] ${message}`);
    }
  }
}

// Main entry point for standalone execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const upstreamUrl = process.env.AGY_UPSTREAM_URL || 'http://127.0.0.1:8317/api/provider/agy';

  const proxy = new AgyProxy({ upstreamUrl, verbose });

  proxy.start().catch((error) => {
    console.error('[agy-proxy] Failed to start:', error);
    process.exit(1);
  });

  // Cleanup on signals
  process.on('SIGTERM', () => {
    proxy.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    proxy.stop();
    process.exit(0);
  });

  process.on('uncaughtException', (error) => {
    console.error('[agy-proxy] Uncaught exception:', error);
    proxy.stop();
    process.exit(1);
  });
}

export default AgyProxy;
