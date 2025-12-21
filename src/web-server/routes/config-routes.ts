/**
 * Config Routes - Unified config management and migration
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import {
  hasUnifiedConfig,
  loadUnifiedConfig,
  saveUnifiedConfig,
  getConfigFormat,
  getConfigYamlPath,
} from '../../config/unified-config-loader';
import {
  needsMigration,
  migrate,
  rollback,
  getBackupDirectories,
} from '../../config/migration-manager';
import { isUnifiedConfig } from '../../config/unified-config-types';

const router = Router();

/**
 * GET /api/config/format - Return current config format and migration status
 */
router.get('/format', (_req: Request, res: Response) => {
  res.json({
    format: getConfigFormat(),
    migrationNeeded: needsMigration(),
    backups: getBackupDirectories(),
  });
});

/**
 * GET /api/config - Return unified config (excludes secrets)
 */
router.get('/', (_req: Request, res: Response): void => {
  if (!hasUnifiedConfig()) {
    res.status(400).json({ error: 'Unified config not enabled' });
    return;
  }

  const config = loadUnifiedConfig();
  if (!config) {
    res.status(500).json({ error: 'Failed to load config' });
    return;
  }

  res.json(config);
});

/**
 * GET /api/config/raw - Return raw YAML content for display
 */
router.get('/raw', (_req: Request, res: Response): void => {
  const yamlPath = getConfigYamlPath();
  if (!fs.existsSync(yamlPath)) {
    res.status(404).json({ error: 'Config file not found' });
    return;
  }
  try {
    const content = fs.readFileSync(yamlPath, 'utf8');
    res.type('text/plain').send(content);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * PUT /api/config - Update unified config
 */
router.put('/', (req: Request, res: Response): void => {
  const config = req.body;

  if (!isUnifiedConfig(config)) {
    res.status(400).json({ error: 'Invalid config format' });
    return;
  }

  try {
    saveUnifiedConfig(config);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/config/migrate - Trigger migration from JSON to YAML
 */
router.post('/migrate', async (req: Request, res: Response) => {
  const dryRun = req.query.dryRun === 'true';
  const result = await migrate(dryRun);
  res.json(result);
});

/**
 * POST /api/config/rollback - Rollback migration to JSON format
 */
router.post('/rollback', async (req: Request, res: Response): Promise<void> => {
  const { backupPath } = req.body;

  if (!backupPath || typeof backupPath !== 'string') {
    res.status(400).json({ error: 'Missing required field: backupPath' });
    return;
  }

  const success = await rollback(backupPath);
  res.json({ success });
});

export default router;
