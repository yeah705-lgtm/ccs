import { startRouter } from './server';
import { getRouterProfile, getRouterPort } from './config/loader';
import { isProfileRunnable } from './config/validator';
import { clearPool } from './providers/pool';
import { invalidateHealthCache } from './providers/health';

interface RouterService {
  profileName: string;
  port: number;
  startedAt: Date;
  stop: () => void;
}

// Active router service (only one at a time)
let activeService: RouterService | null = null;

/**
 * Start router service for a profile
 */
export async function startRouterService(
  profileName: string,
  port?: number
): Promise<RouterService> {
  // Stop existing service if running
  if (activeService) {
    console.log(`[i] Stopping existing router: ${activeService.profileName}`);
    stopRouterService();
  }

  // Get and validate profile
  const profile = getRouterProfile(profileName);
  if (!profile) {
    throw new Error(`Router profile "${profileName}" not found`);
  }

  const { runnable, missing } = await isProfileRunnable(profileName);
  if (!runnable) {
    throw new Error(`Profile "${profileName}" cannot run: ${missing.join(', ')}`);
  }

  // Start server
  const routerPort = port ?? getRouterPort();
  const { stop } = startRouter(profile, profileName, routerPort);

  activeService = {
    profileName,
    port: routerPort,
    startedAt: new Date(),
    stop,
  };

  return activeService;
}

/**
 * Stop active router service
 */
export function stopRouterService(): void {
  if (activeService) {
    activeService.stop();
    clearPool();
    invalidateHealthCache();
    activeService = null;
  }
}

/**
 * Get active router service status
 */
export function getRouterServiceStatus(): {
  active: boolean;
  profileName?: string;
  port?: number;
  uptime?: number;
} {
  if (!activeService) {
    return { active: false };
  }

  return {
    active: true,
    profileName: activeService.profileName,
    port: activeService.port,
    uptime: Date.now() - activeService.startedAt.getTime(),
  };
}

/**
 * Check if router service is running
 */
export function isRouterServiceActive(): boolean {
  return activeService !== null;
}
