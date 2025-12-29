/**
 * Profile Routes - CRUD operations for user profiles
 *
 * Uses unified config (config.yaml) when available, falls back to legacy (config.json).
 * Note: Account routes have been moved to account-routes.ts
 */

import { Router, Request, Response } from 'express';
import { isReservedName, RESERVED_PROFILE_NAMES } from '../../config/reserved-names';
import { createApiProfile, removeApiProfile } from '../../api/services/profile-writer';
import { apiProfileExists, listApiProfiles } from '../../api/services/profile-reader';
import { updateSettingsFile } from './route-helpers';

const router = Router();

// ==================== Profile CRUD ====================

/**
 * GET /api/profiles - List all profiles
 */
router.get('/', (_req: Request, res: Response): void => {
  try {
    const result = listApiProfiles();
    // Map isConfigured -> configured for UI compatibility
    const profiles = result.profiles.map((p) => ({
      name: p.name,
      settingsPath: p.settingsPath,
      configured: p.isConfigured,
    }));
    res.json({ profiles });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/profiles - Create new profile
 */
router.post('/', (req: Request, res: Response): void => {
  const { name, baseUrl, apiKey, model, opusModel, sonnetModel, haikuModel } = req.body;

  if (!name || !baseUrl || !apiKey) {
    res.status(400).json({ error: 'Missing required fields: name, baseUrl, apiKey' });
    return;
  }

  // Validate reserved names
  if (isReservedName(name)) {
    res.status(400).json({
      error: `Profile name '${name}' is reserved`,
      reserved: RESERVED_PROFILE_NAMES,
    });
    return;
  }

  // Check if profile already exists (uses unified config when available)
  if (apiProfileExists(name)) {
    res.status(409).json({ error: 'Profile already exists' });
    return;
  }

  // Create profile using unified-config-aware service
  const result = createApiProfile(name, baseUrl, apiKey, {
    default: model || '',
    opus: opusModel || model || '',
    sonnet: sonnetModel || model || '',
    haiku: haikuModel || model || '',
  });

  if (!result.success) {
    res.status(500).json({ error: result.error || 'Failed to create profile' });
    return;
  }

  res.status(201).json({ name, settingsPath: result.settingsFile });
});

/**
 * PUT /api/profiles/:name - Update profile
 */
router.put('/:name', (req: Request, res: Response): void => {
  const { name } = req.params;
  const { baseUrl, apiKey, model, opusModel, sonnetModel, haikuModel } = req.body;

  // Check if profile exists (uses unified config when available)
  if (!apiProfileExists(name)) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  // Validate required fields if provided (prevent setting to empty)
  if (baseUrl !== undefined && !baseUrl.trim()) {
    res.status(400).json({ error: 'baseUrl cannot be empty' });
    return;
  }
  if (apiKey !== undefined && !apiKey.trim()) {
    res.status(400).json({ error: 'apiKey cannot be empty' });
    return;
  }

  try {
    updateSettingsFile(name, { baseUrl, apiKey, model, opusModel, sonnetModel, haikuModel });
    res.json({ name, updated: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/profiles/:name - Delete profile
 */
router.delete('/:name', (req: Request, res: Response): void => {
  const { name } = req.params;

  // Check if profile exists (uses unified config when available)
  if (!apiProfileExists(name)) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  // Remove profile using unified-config-aware service
  const result = removeApiProfile(name);

  if (!result.success) {
    res.status(500).json({ error: result.error || 'Failed to delete profile' });
    return;
  }

  res.json({ name, deleted: true });
});

export default router;
