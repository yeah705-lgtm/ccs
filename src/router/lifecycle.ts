import { spawn, type ChildProcess } from 'child_process';
import { startRouterService, stopRouterService } from './service';
import { getRouterProfile, getRouterPort } from './config/loader';
import { getRouterEnvVars } from './config/generator';

interface SessionContext {
  profileName: string;
  claudeProcess: ChildProcess;
  routerPort: number;
}

let activeSession: SessionContext | null = null;

/**
 * Run Claude CLI with router profile
 * This is the main entry point for `ccs <router-profile>`
 */
export async function runRouterSession(
  profileName: string,
  claudeArgs: string[] = [],
  options: { debug?: boolean; port?: number } = {}
): Promise<number> {
  const profile = getRouterProfile(profileName);
  if (!profile) {
    throw new Error(`Router profile "${profileName}" not found`);
  }

  const port = options.port ?? getRouterPort();

  // Track router and process state
  let routerStarted = false;
  let claudeProcess: ChildProcess | null = null;

  // Handle signals
  const cleanup = () => {
    if (routerStarted) {
      stopRouterService();
      routerStarted = false;
    }
    if (claudeProcess && !claudeProcess.killed) {
      claudeProcess.kill('SIGTERM');
    }
    activeSession = null;
  };

  // Register signal handlers BEFORE starting router
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    // Start router service
    await startRouterService(profileName, port);
    routerStarted = true;

    if (options.debug) {
      console.log(`[Router] Started on port ${port}`);
      console.log(`[Router] Profile: ${profileName}`);
      console.log(`[Router] Tier routing:`);
      console.log(`  opus:   ${profile.tiers.opus.provider}/${profile.tiers.opus.model}`);
      console.log(`  sonnet: ${profile.tiers.sonnet.provider}/${profile.tiers.sonnet.model}`);
      console.log(`  haiku:  ${profile.tiers.haiku.provider}/${profile.tiers.haiku.model}`);
    }

    // Build environment for Claude CLI
    const env = {
      ...process.env,
      ...getRouterEnvVars(profile, port),
    };

    // Spawn Claude CLI
    claudeProcess = spawn('claude', claudeArgs, {
      stdio: 'inherit',
      env,
    });

    activeSession = {
      profileName,
      claudeProcess,
      routerPort: port,
    };
  } catch (err) {
    // Remove signal handlers and cleanup on startup failure
    process.removeListener('SIGINT', cleanup);
    process.removeListener('SIGTERM', cleanup);
    cleanup();
    throw err;
  }

  // Wait for Claude to exit
  return new Promise<number>((resolve) => {
    if (!claudeProcess) {
      resolve(1);
      return;
    }

    claudeProcess.on('exit', (code) => {
      // Remove signal handlers to prevent memory leaks
      process.removeListener('SIGINT', cleanup);
      process.removeListener('SIGTERM', cleanup);
      cleanup();
      resolve(code ?? 0);
    });

    claudeProcess.on('error', (err) => {
      // Remove signal handlers to prevent memory leaks
      process.removeListener('SIGINT', cleanup);
      process.removeListener('SIGTERM', cleanup);
      console.error(`[Router] Claude process error: ${err.message}`);
      cleanup();
      resolve(1);
    });
  });
}

/**
 * Get active session info
 */
export function getActiveSession(): SessionContext | null {
  return activeSession;
}
