/**
 * Misc Routes - Generic file API and global environment variables
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir } from '../../utils/config-manager';
import { expandPath } from '../../utils/helpers';
import {
  loadOrCreateUnifiedConfig,
  saveUnifiedConfig,
  getGlobalEnvConfig,
  getThinkingConfig,
  getConfigYamlPath,
} from '../../config/unified-config-loader';
import type { ThinkingConfig } from '../../config/unified-config-types';
import {
  THINKING_BUDGET_MIN,
  THINKING_BUDGET_MAX,
  VALID_THINKING_LEVELS,
  VALID_THINKING_TIERS,
  THINKING_OFF_VALUES,
} from '../../cliproxy';
import { validateFilePath } from './route-helpers';

const router = Router();

// ==================== Generic File API ====================

/**
 * GET /api/file - Read a file with path validation
 * Query params: path (required)
 * Returns: { content: string, mtime: number, readonly: boolean, path: string }
 */
router.get('/file', (req: Request, res: Response): void => {
  const filePath = req.query.path as string;

  if (!filePath) {
    res.status(400).json({ error: 'Missing required query parameter: path' });
    return;
  }

  const validation = validateFilePath(filePath);
  if (!validation.valid) {
    res.status(403).json({ error: validation.error });
    return;
  }

  const expandedPath = expandPath(filePath);

  if (!fs.existsSync(expandedPath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  try {
    const stat = fs.statSync(expandedPath);
    const content = fs.readFileSync(expandedPath, 'utf8');

    res.json({
      content,
      mtime: stat.mtime.getTime(),
      readonly: validation.readonly,
      path: expandedPath,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/file - Write a file with conflict detection and backup
 * Query params: path (required)
 * Body: { content: string, expectedMtime?: number }
 * Returns: { success: true, mtime: number, backupPath?: string }
 */
router.put('/file', (req: Request, res: Response): void => {
  const filePath = req.query.path as string;
  const { content, expectedMtime } = req.body;

  if (!filePath) {
    res.status(400).json({ error: 'Missing required query parameter: path' });
    return;
  }

  if (typeof content !== 'string') {
    res.status(400).json({ error: 'Missing required field: content' });
    return;
  }

  const validation = validateFilePath(filePath);
  if (!validation.valid) {
    res.status(403).json({ error: validation.error });
    return;
  }

  if (validation.readonly) {
    res.status(403).json({ error: 'File is read-only' });
    return;
  }

  const expandedPath = expandPath(filePath);
  const ccsDir = getCcsDir();

  // Conflict detection (if file exists and expectedMtime provided)
  if (fs.existsSync(expandedPath) && expectedMtime !== undefined) {
    const stat = fs.statSync(expandedPath);
    if (stat.mtime.getTime() !== expectedMtime) {
      res.status(409).json({
        error: 'File modified externally',
        currentMtime: stat.mtime.getTime(),
      });
      return;
    }
  }

  try {
    // Create backup if file exists
    let backupPath: string | undefined;
    if (fs.existsSync(expandedPath)) {
      const backupDir = path.join(ccsDir, 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const filename = path.basename(expandedPath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      backupPath = path.join(backupDir, `${filename}.${timestamp}.bak`);
      fs.copyFileSync(expandedPath, backupPath);
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(expandedPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Write atomically
    const tempPath = expandedPath + '.tmp';
    fs.writeFileSync(tempPath, content);
    fs.renameSync(tempPath, expandedPath);

    const newStat = fs.statSync(expandedPath);
    res.json({
      success: true,
      mtime: newStat.mtime.getTime(),
      backupPath,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/files - List editable files in ~/.ccs/
 * Returns: { files: Array<{ name: string, path: string, mtime: number }> }
 */
router.get('/files', (_req: Request, res: Response): void => {
  const ccsDir = getCcsDir();

  if (!fs.existsSync(ccsDir)) {
    res.json({ files: [] });
    return;
  }

  try {
    const entries = fs.readdirSync(ccsDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => {
        const filePath = path.join(ccsDir, entry.name);
        const stat = fs.statSync(filePath);
        return {
          name: entry.name,
          path: `~/.ccs/${entry.name}`,
          mtime: stat.mtime.getTime(),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== Global Environment Variables ====================

/**
 * GET /api/global-env - Get global environment variables configuration
 * Returns the global_env section from config.yaml
 */
router.get('/global-env', (_req: Request, res: Response): void => {
  try {
    const config = getGlobalEnvConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/global-env - Update global environment variables configuration
 * Updates the global_env section in config.yaml
 */
router.put('/global-env', (req: Request, res: Response): void => {
  try {
    const { enabled, env } = req.body;
    const config = loadOrCreateUnifiedConfig();

    // Validate env is an object with string values
    if (env !== undefined && typeof env === 'object' && env !== null) {
      for (const [key, value] of Object.entries(env)) {
        if (typeof value !== 'string') {
          res.status(400).json({ error: `Invalid value for ${key}: must be a string` });
          return;
        }
      }
    }

    // Update global_env section
    config.global_env = {
      enabled: enabled ?? config.global_env?.enabled ?? true,
      env: env ?? config.global_env?.env ?? {},
    };

    saveUnifiedConfig(config);
    res.json({ success: true, config: config.global_env });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== Thinking Configuration ====================

/**
 * GET /api/thinking - Get thinking budget configuration
 * Returns the thinking section from config.yaml with mtime for optimistic locking
 */
router.get('/thinking', (_req: Request, res: Response): void => {
  try {
    const config = getThinkingConfig();
    // W4: Include mtime for optimistic locking
    let lastModified: number | undefined;
    try {
      const stats = fs.statSync(getConfigYamlPath());
      lastModified = stats.mtimeMs;
    } catch {
      // File may not exist yet
    }
    res.json({ config, lastModified });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/thinking - Update thinking budget configuration
 * Updates the thinking section in config.yaml
 * Supports optimistic locking via lastModified field
 */
router.put('/thinking', (req: Request, res: Response): void => {
  try {
    const { lastModified, ...updates } = req.body as Partial<ThinkingConfig> & {
      lastModified?: number;
    };

    // W4: Optimistic locking - check if file was modified since last read
    if (lastModified !== undefined) {
      try {
        const stats = fs.statSync(getConfigYamlPath());
        if (stats.mtimeMs > lastModified) {
          res.status(409).json({
            error: 'Config was modified by another process. Please refresh and try again.',
            currentMtime: stats.mtimeMs,
          });
          return;
        }
      } catch {
        // File may not exist yet, allow creation
      }
    }

    const config = loadOrCreateUnifiedConfig();

    // Validate mode if provided
    if (updates.mode !== undefined) {
      const validModes = ['auto', 'off', 'manual'];
      if (!validModes.includes(updates.mode)) {
        res.status(400).json({ error: `Invalid mode: must be one of ${validModes.join(', ')}` });
        return;
      }
    }

    // Validate override if provided (budget or level)
    if (updates.override !== undefined) {
      // C3: Reject objects/arrays - only number or string allowed
      if (typeof updates.override !== 'number' && typeof updates.override !== 'string') {
        res.status(400).json({
          error: 'Invalid override: must be a number or string, not object/array',
        });
        return;
      }

      if (typeof updates.override === 'number') {
        if (
          !Number.isFinite(updates.override) ||
          updates.override < THINKING_BUDGET_MIN ||
          updates.override > THINKING_BUDGET_MAX
        ) {
          res.status(400).json({
            error: `Invalid override: must be between ${THINKING_BUDGET_MIN} and ${THINKING_BUDGET_MAX}`,
          });
          return;
        }
      } else if (typeof updates.override === 'string') {
        const normalizedValue = updates.override.toLowerCase().trim();
        const validValues = [...VALID_THINKING_LEVELS, ...THINKING_OFF_VALUES] as readonly string[];
        if (!validValues.includes(normalizedValue)) {
          res.status(400).json({
            error: `Invalid override: must be a level name (${VALID_THINKING_LEVELS.join(', ')}) or a number`,
          });
          return;
        }
      }
    }

    // Validate tier_defaults if provided
    if (updates.tier_defaults !== undefined) {
      if (
        typeof updates.tier_defaults !== 'object' ||
        updates.tier_defaults === null ||
        Array.isArray(updates.tier_defaults)
      ) {
        res.status(400).json({ error: 'Invalid tier_defaults: must be an object' });
        return;
      }
      const validLevels = [...VALID_THINKING_LEVELS] as string[];
      for (const [tier, level] of Object.entries(updates.tier_defaults)) {
        if (!(VALID_THINKING_TIERS as readonly string[]).includes(tier)) {
          res.status(400).json({ error: `Invalid tier: ${tier}` });
          return;
        }
        if (!validLevels.includes(level)) {
          res.status(400).json({
            error: `Invalid level for ${tier}: must be one of ${validLevels.join(', ')}`,
          });
          return;
        }
      }
    }

    // C4: Validate provider_overrides if provided (nested structure: Record<string, Partial<ThinkingTierDefaults>>)
    if (updates.provider_overrides !== undefined) {
      if (
        typeof updates.provider_overrides !== 'object' ||
        updates.provider_overrides === null ||
        Array.isArray(updates.provider_overrides)
      ) {
        res.status(400).json({ error: 'Invalid provider_overrides: must be an object' });
        return;
      }
      const validLevels = [...VALID_THINKING_LEVELS] as string[];
      const validTiers = [...VALID_THINKING_TIERS] as string[];
      for (const [provider, tierOverrides] of Object.entries(updates.provider_overrides)) {
        if (typeof provider !== 'string' || provider.trim() === '') {
          res
            .status(400)
            .json({ error: 'Invalid provider_overrides: keys must be non-empty strings' });
          return;
        }
        // tierOverrides should be Partial<ThinkingTierDefaults>
        if (typeof tierOverrides !== 'object' || tierOverrides === null) {
          res.status(400).json({
            error: `Invalid provider_overrides for ${provider}: must be an object with tier→level mapping`,
          });
          return;
        }
        for (const [tier, level] of Object.entries(tierOverrides)) {
          if (!validTiers.includes(tier)) {
            res.status(400).json({
              error: `Invalid tier '${tier}' in provider_overrides.${provider}: must be one of ${validTiers.join(', ')}`,
            });
            return;
          }
          if (typeof level !== 'string' || !validLevels.includes(level)) {
            res.status(400).json({
              error: `Invalid level for provider_overrides.${provider}.${tier}: must be one of ${validLevels.join(', ')}`,
            });
            return;
          }
        }
      }
    }

    // Update thinking section
    config.thinking = {
      mode: updates.mode ?? config.thinking?.mode ?? 'auto',
      override: updates.override ?? config.thinking?.override,
      tier_defaults: {
        opus: updates.tier_defaults?.opus ?? config.thinking?.tier_defaults?.opus ?? 'high',
        sonnet: updates.tier_defaults?.sonnet ?? config.thinking?.tier_defaults?.sonnet ?? 'medium',
        haiku: updates.tier_defaults?.haiku ?? config.thinking?.tier_defaults?.haiku ?? 'low',
      },
      provider_overrides: updates.provider_overrides ?? config.thinking?.provider_overrides,
      show_warnings: updates.show_warnings ?? config.thinking?.show_warnings ?? true,
    };

    saveUnifiedConfig(config);

    // W4: Return new mtime for subsequent requests
    let newMtime: number | undefined;
    try {
      const stats = fs.statSync(getConfigYamlPath());
      newMtime = stats.mtimeMs;
    } catch {
      // Ignore
    }

    res.json({ success: true, config: config.thinking, lastModified: newMtime });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
