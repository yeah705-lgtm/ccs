/**
 * CLIProxy Server Routes - API endpoints for proxy configuration
 *
 * Provides REST endpoints for managing CLIProxyAPI connection settings:
 * - GET /api/cliproxy-server - Get proxy configuration
 * - PUT /api/cliproxy-server - Update proxy configuration
 * - POST /api/cliproxy-server/test - Test remote connection
 */

import { Router, Request, Response } from 'express';
import { loadOrCreateUnifiedConfig, saveUnifiedConfig } from '../../config/unified-config-loader';
import { testConnection } from '../../cliproxy/remote-proxy-client';
import {
  DEFAULT_CLIPROXY_SERVER_CONFIG,
  CliproxyServerConfig,
} from '../../config/unified-config-types';

const router = Router();

/**
 * GET /api/cliproxy-server - Get proxy configuration
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const config = await loadOrCreateUnifiedConfig();
    res.json(config.cliproxy_server || DEFAULT_CLIPROXY_SERVER_CONFIG);
  } catch (error) {
    console.error('[cliproxy-server-routes] Failed to load proxy config:', error);
    res.status(500).json({ error: 'Failed to load proxy config' });
  }
});

/**
 * PUT /api/cliproxy-server - Update proxy configuration
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const config = await loadOrCreateUnifiedConfig();
    const updates = req.body as Partial<CliproxyServerConfig>;

    // Deep merge with defaults and current config
    config.cliproxy_server = {
      remote: {
        ...DEFAULT_CLIPROXY_SERVER_CONFIG.remote,
        ...config.cliproxy_server?.remote,
        ...updates.remote,
      },
      fallback: {
        ...DEFAULT_CLIPROXY_SERVER_CONFIG.fallback,
        ...config.cliproxy_server?.fallback,
        ...updates.fallback,
      },
      local: {
        ...DEFAULT_CLIPROXY_SERVER_CONFIG.local,
        ...config.cliproxy_server?.local,
        ...updates.local,
      },
    };

    await saveUnifiedConfig(config);
    res.json(config.cliproxy_server);
  } catch (error) {
    console.error('[cliproxy-server-routes] Failed to save proxy config:', error);
    res.status(500).json({ error: 'Failed to save proxy config' });
  }
});

/**
 * POST /api/cliproxy-server/test - Test remote proxy connection
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { host, port, protocol, authToken, allowSelfSigned } = req.body;

    // Host is required, port is optional (uses protocol defaults)
    if (!host) {
      res.status(400).json({ error: 'Host is required' });
      return;
    }

    // Parse port - treat empty string, 0, null as "use default"
    const parsedPort = port && port !== '' ? parseInt(String(port), 10) : undefined;
    const effectivePort =
      parsedPort && !isNaN(parsedPort) && parsedPort > 0 ? parsedPort : undefined;

    const status = await testConnection({
      host,
      port: effectivePort,
      protocol: protocol || 'http',
      authToken,
      allowSelfSigned: allowSelfSigned || false,
      timeout: 5000,
    });

    res.json(status);
  } catch (error) {
    console.error('[cliproxy-server-routes] Failed to test connection:', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

export default router;
