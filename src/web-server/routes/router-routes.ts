/**
 * Router Routes - Router profile management API
 *
 * Endpoints:
 * - GET/POST /profiles - List/create router profiles
 * - GET/PUT/DELETE /profiles/:name - Profile CRUD
 * - GET /providers - List providers with health status
 * - POST /profiles/:name/test - Test profile configuration
 */

import { Router, Request, Response } from 'express';
import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadRouterConfig, getRouterProfile } from '../../router/config/loader';
import { saveRouterProfile, deleteRouterProfile } from '../../router/config/writer';
import { routerProfileSchema } from '../../router/config/schema';
import { generateRouterSettings, getRouterSettingsPath } from '../../router/config/generator';
import { getCcsDir } from '../../utils/config-manager';
import {
  getAllProviders,
  checkAllProvidersHealth,
  checkProviderHealth,
  getProvider,
} from '../../router/providers';

const router = Router();

/**
 * GET /api/router/profiles - List all router profiles
 */
router.get('/profiles', (_req: Request, res: Response): void => {
  try {
    const config = loadRouterConfig();
    const profiles = config?.profiles
      ? Object.entries(config.profiles).map(([name, profile]) => ({
          name,
          description: profile.description,
          tiers: Object.keys(profile.tiers),
          // Include tier configs for better card display
          tierConfigs: {
            opus: profile.tiers.opus,
            sonnet: profile.tiers.sonnet,
            haiku: profile.tiers.haiku,
          },
        }))
      : [];
    res.json({ profiles });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/router/profiles/:name - Get a specific router profile
 */
router.get('/profiles/:name', (req: Request, res: Response): void => {
  try {
    const profile = getRouterProfile(req.params.name);
    if (!profile) {
      res.status(404).json({ error: `Profile '${req.params.name}' not found` });
      return;
    }
    res.json({ name: req.params.name, ...profile });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/router/profiles - Create a new router profile
 * Body: { name, description?, tiers: { opus, sonnet, haiku } }
 */
router.post('/profiles', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, ...profileData } = req.body;

    // Validation
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    // Check duplicate
    if (getRouterProfile(name)) {
      res.status(409).json({ error: `Profile '${name}' already exists` });
      return;
    }

    // Validate profile schema
    const parsed = routerProfileSchema.safeParse(profileData);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    await saveRouterProfile(name, parsed.data);
    res.status(201).json({ success: true, name });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/router/profiles/:name - Update an existing router profile
 * Body: { description?, tiers? }
 */
router.put('/profiles/:name', async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = getRouterProfile(req.params.name);
    if (!existing) {
      res.status(404).json({ error: `Profile '${req.params.name}' not found` });
      return;
    }

    // Merge with existing data if partial update
    const mergedData = {
      ...existing,
      ...req.body,
    };

    const parsed = routerProfileSchema.safeParse(mergedData);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    await saveRouterProfile(req.params.name, parsed.data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/router/profiles/:name - Delete a router profile
 */
router.delete('/profiles/:name', async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await deleteRouterProfile(req.params.name);
    if (!deleted) {
      res.status(404).json({ error: `Profile '${req.params.name}' not found` });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/router/providers - List all providers with health status
 */
router.get('/providers', async (_req: Request, res: Response): Promise<void> => {
  try {
    const providers = await getAllProviders();
    const healthResults = await checkAllProvidersHealth(providers);

    const providersWithHealth = providers.map((p) => {
      const health = healthResults.find((h) => h.provider === p.name);
      return {
        name: p.name,
        type: p.type,
        baseUrl: p.baseUrl,
        healthy: health?.healthy ?? false,
        latency: health?.latency,
        error: health?.error,
      };
    });

    res.json({ providers: providersWithHealth });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/router/profiles/:name/test - Test profile configuration
 * Validates all tier providers exist and are reachable
 */
router.post('/profiles/:name/test', async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = getRouterProfile(req.params.name);
    if (!profile) {
      res.status(404).json({ error: `Profile '${req.params.name}' not found` });
      return;
    }

    // Test each tier's provider
    const results: Record<string, { valid: boolean; latency?: number; error?: string } | null> = {
      opus: null,
      sonnet: null,
      haiku: null,
    };

    for (const [tier, config] of Object.entries(profile.tiers)) {
      const provider = await getProvider(config.provider);
      if (!provider) {
        results[tier] = { valid: false, error: `Provider '${config.provider}' not found` };
        continue;
      }
      const health = await checkProviderHealth(provider);
      results[tier] = { valid: health.healthy, latency: health.latency, error: health.error };
    }

    res.json({ profile: req.params.name, results });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== Router Settings ====================

/**
 * GET /api/router/profiles/:name/settings - Get router settings file
 * Returns generated settings or file content if customized
 */
router.get('/profiles/:name/settings', (req: Request, res: Response): void => {
  try {
    const profile = getRouterProfile(req.params.name);
    if (!profile) {
      res.status(404).json({ error: `Profile '${req.params.name}' not found` });
      return;
    }

    const ccsDir = getCcsDir();
    const settingsPath = getRouterSettingsPath(ccsDir, req.params.name);

    // If settings file exists, return it
    if (existsSync(settingsPath)) {
      const stat = statSync(settingsPath);
      const content = readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      res.json({
        profile: req.params.name,
        settings,
        mtime: stat.mtime.getTime(),
        path: settingsPath,
        generated: false,
      });
      return;
    }

    // Otherwise generate settings from profile
    const settings = generateRouterSettings(profile);
    res.json({
      profile: req.params.name,
      settings,
      path: settingsPath,
      generated: true,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/router/profiles/:name/settings - Update router settings file
 * Creates/updates the settings.json for customization
 */
router.put('/profiles/:name/settings', (req: Request, res: Response): void => {
  try {
    const profile = getRouterProfile(req.params.name);
    if (!profile) {
      res.status(404).json({ error: `Profile '${req.params.name}' not found` });
      return;
    }

    const { settings, expectedMtime } = req.body;

    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ error: 'settings object is required' });
      return;
    }

    const ccsDir = getCcsDir();
    const settingsPath = getRouterSettingsPath(ccsDir, req.params.name);
    const fileExists = existsSync(settingsPath);

    // Check for conflict if file exists and expectedMtime provided
    if (fileExists && expectedMtime) {
      const stat = statSync(settingsPath);
      if (stat.mtime.getTime() !== expectedMtime) {
        res.status(409).json({
          error: 'File modified externally',
          currentMtime: stat.mtime.getTime(),
        });
        return;
      }
    }

    // Ensure directory exists
    mkdirSync(dirname(settingsPath), { recursive: true });

    // Write settings atomically
    const tempPath = settingsPath + '.tmp';
    writeFileSync(tempPath, JSON.stringify(settings, null, 2) + '\n');
    renameSync(tempPath, settingsPath);

    const newStat = statSync(settingsPath);
    res.json({
      success: true,
      mtime: newStat.mtime.getTime(),
      path: settingsPath,
      created: !fileExists,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/router/profiles/:name/settings/regenerate - Regenerate settings from profile
 * Overwrites custom settings with freshly generated ones
 */
router.post('/profiles/:name/settings/regenerate', (req: Request, res: Response): void => {
  try {
    const profile = getRouterProfile(req.params.name);
    if (!profile) {
      res.status(404).json({ error: `Profile '${req.params.name}' not found` });
      return;
    }

    const ccsDir = getCcsDir();
    const settingsPath = getRouterSettingsPath(ccsDir, req.params.name);

    // Generate fresh settings
    const settings = generateRouterSettings(profile);

    // Ensure directory exists
    mkdirSync(dirname(settingsPath), { recursive: true });

    // Write settings
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

    const stat = statSync(settingsPath);
    res.json({
      success: true,
      settings,
      mtime: stat.mtime.getTime(),
      path: settingsPath,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
