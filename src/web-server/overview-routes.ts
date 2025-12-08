/**
 * Overview Routes (Phase 07)
 *
 * Dashboard overview API for counts and health summary.
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir, loadConfig } from '../utils/config-manager';
import { runHealthChecks } from './health-service';
import { getAllAuthStatus, initializeAccounts } from '../cliproxy/auth-handler';
import { getVersion } from '../utils/version';

export const overviewRoutes = Router();

/**
 * GET /api/overview
 */
overviewRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const config = loadConfig();

    const profileCount = Object.keys(config.profiles).length;
    const cliproxyVariantCount = Object.keys(config.cliproxy || {}).length;

    // Count authenticated built-in providers (gemini, codex, agy, qwen, iflow)
    initializeAccounts();
    const authStatuses = getAllAuthStatus();
    const authenticatedProviderCount = authStatuses.filter((s) => s.authenticated).length;

    // Total CLIProxy = custom variants + authenticated providers
    const totalCliproxyCount = cliproxyVariantCount + authenticatedProviderCount;

    // Get quick health summary
    const health = await runHealthChecks();

    res.json({
      version: getVersion(),
      profiles: profileCount,
      cliproxy: totalCliproxyCount,
      cliproxyVariants: cliproxyVariantCount,
      cliproxyProviders: authenticatedProviderCount,
      accounts: getAccountCount(),
      health: {
        status:
          health.summary.errors > 0 ? 'error' : health.summary.warnings > 0 ? 'warning' : 'ok',
        passed: health.summary.passed,
        total: health.summary.total,
      },
    });
  } catch {
    res.json({
      version: getVersion(),
      profiles: 0,
      cliproxy: 0,
      cliproxyVariants: 0,
      cliproxyProviders: 0,
      accounts: 0,
      health: { status: 'error', passed: 0, total: 0 },
    });
  }
});

function getAccountCount(): number {
  try {
    const profilesPath = path.join(getCcsDir(), 'profiles.json');

    if (!fs.existsSync(profilesPath)) return 0;

    const data = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
    return Object.keys(data.profiles || {}).length;
  } catch {
    return 0;
  }
}
