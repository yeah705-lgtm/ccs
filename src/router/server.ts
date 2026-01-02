import { Hono, type Context, type Next } from 'hono';
import { streamSSE } from 'hono/streaming';
import { HTTPException } from 'hono/http-exception';

import type { RouterProfile } from './config/schema';
import type { ResolvedRoute } from './providers/types';
import type { AnthropicRequest, ProviderAdapter } from './adapters/base';
import { resolveRoute } from './resolver/route';
import { getAdapter } from './adapters';
import { checkProviderHealth } from './providers/health';

// Router context variables
interface RouterVariables {
  profile: RouterProfile;
  profileName: string;
  route: ResolvedRoute;
  requestBody: AnthropicRequest;
}

type RouterContext = Context<{ Variables: RouterVariables }>;

/**
 * Create router HTTP server
 */
export function createRouterServer(profile: RouterProfile, profileName: string) {
  const app = new Hono<{ Variables: RouterVariables }>();

  // Request logging middleware
  app.use('*', async (c: RouterContext, next: Next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    console.log(`[Router] ${c.req.method} ${c.req.path} - ${c.res.status} (${duration}ms)`);
  });

  // Store profile in context
  app.use('*', async (c: RouterContext, next: Next) => {
    c.set('profile', profile);
    c.set('profileName', profileName);
    await next();
  });

  // Health endpoint
  app.get('/health', (c: RouterContext) => {
    return c.json({ status: 'ok', profile: c.get('profileName') });
  });

  // Models endpoint (passthrough first available provider)
  app.get('/v1/models', async (c: RouterContext) => {
    const prof = c.get('profile');
    const route = await resolveRoute('claude-sonnet-4', prof);

    const adapter = getAdapter(route.provider.adapter);
    const headers = adapter?.getHeaders(route.provider) ?? {};

    const resp = await fetch(`${route.provider.baseUrl}/models`, { headers });

    return new Response(resp.body, {
      status: resp.status,
      headers: resp.headers,
    });
  });

  // Main messages endpoint
  app.post('/v1/messages', async (c: RouterContext) => {
    // Parse request body
    let body: AnthropicRequest;
    try {
      body = await c.req.json<AnthropicRequest>();
    } catch {
      throw new HTTPException(400, { message: 'Invalid JSON in request body' });
    }
    c.set('requestBody', body);

    // Resolve route from model name
    const prof = c.get('profile');
    const route = await resolveRoute(body.model, prof);

    // Check provider health
    const health = await checkProviderHealth(route.provider);
    if (!health.healthy) {
      throw new HTTPException(503, {
        message: `Provider ${route.provider.name} is unhealthy: ${health.error}`,
      });
    }

    c.set('route', route);

    const adapter = getAdapter(route.provider.adapter);
    if (!adapter) {
      throw new HTTPException(500, {
        message: `No adapter found for: ${route.provider.adapter}`,
      });
    }

    // Transform request
    const transformedBody = adapter.transformRequest(body, route.targetModel, route.provider);

    // Get endpoint and headers
    const endpoint = adapter.getEndpoint(route.provider);
    const headers = adapter.getHeaders(route.provider);

    console.log(`[Router] Routing ${body.model} -> ${route.provider.name}/${route.targetModel}`);

    // Handle streaming
    if (body.stream) {
      return handleStreamingRequest(c, endpoint, headers, transformedBody, adapter);
    }

    // Handle regular request
    return handleRegularRequest(c, endpoint, headers, transformedBody, adapter);
  });

  // Error handler
  app.onError((err: Error, c: RouterContext) => {
    console.error('[Router] Error:', err.message);

    if (err instanceof HTTPException) {
      return err.getResponse();
    }

    return c.json(
      {
        error: {
          type: 'router_error',
          message: err.message,
        },
      },
      500
    );
  });

  return app;
}

/**
 * Handle regular (non-streaming) request
 */
async function handleRegularRequest(
  c: RouterContext,
  endpoint: string,
  headers: Record<string, string>,
  body: unknown,
  adapter: ProviderAdapter
) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new HTTPException(response.status as 400 | 401 | 403 | 404 | 500 | 502 | 503, {
      message: `Upstream error: ${errorText}`,
    });
  }

  const text = await response.text();
  if (!text) {
    throw new HTTPException(502, { message: 'Empty response from upstream provider' });
  }
  const upstreamResponse = JSON.parse(text);
  const transformed = adapter.transformResponse(upstreamResponse);

  return c.json(transformed);
}

/**
 * Handle streaming request
 */
async function handleStreamingRequest(
  c: RouterContext,
  endpoint: string,
  headers: Record<string, string>,
  body: unknown,
  adapter: ProviderAdapter
) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    throw new HTTPException(response.status as 400 | 401 | 403 | 404 | 500 | 502 | 503, {
      message: `Upstream streaming error: ${errorText}`,
    });
  }

  // Store body reference for type narrowing in callback
  const responseBody = response.body;

  // Stream the response
  return streamSSE(c, async (stream) => {
    const reader = responseBody.getReader();
    const decoder = new TextDecoder();

    stream.onAbort(() => {
      console.log('[Router] Client disconnected');
      reader.cancel();
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          // Transform chunk format
          const transformed = adapter.transformStreamChunk(line);
          if (transformed) {
            await stream.write(transformed);
          }
        }
      }
    } catch (error) {
      console.error('[Router] Stream error:', error);
    }
  });
}

/**
 * Start router server using Bun.serve
 */
export function startRouter(
  profile: RouterProfile,
  profileName: string,
  port: number = 9400
): { stop: () => void } {
  const app = createRouterServer(profile, profileName);

  // Use globalThis.Bun for Bun runtime
  const BunRuntime = globalThis.Bun;
  if (!BunRuntime) {
    throw new Error('Bun runtime required for startRouter');
  }

  let server: ReturnType<typeof BunRuntime.serve>;
  try {
    server = BunRuntime.serve({
      port,
      hostname: '127.0.0.1',
      fetch: app.fetch,
    });
  } catch (err) {
    const error = err as Error;
    if (
      error.message?.includes('EADDRINUSE') ||
      error.message?.includes('address already in use')
    ) {
      throw new Error(`Port ${port} is already in use. Try a different port with --port`);
    }
    throw error;
  }

  console.log(`[Router] Started on port ${port}`);

  return {
    stop: () => {
      server.stop();
      console.log('[Router] Stopped');
    },
  };
}
