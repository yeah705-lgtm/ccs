/**
 * Session Tracker for CLIProxy Multi-Instance Support
 *
 * Manages reference counting for shared CLIProxy instances.
 * Multiple CCS sessions can share a single proxy on the same port.
 * Proxy only terminates when ALL sessions exit (count reaches 0).
 *
 * Lock file format: ~/.ccs/cliproxy/sessions.json
 * {
 *   "port": 8317,
 *   "pid": 12345,        // CLIProxy process PID
 *   "sessions": ["abc123", "def456"],  // Active session IDs
 *   "startedAt": "2024-01-01T00:00:00Z"
 * }
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getCliproxyDir } from './config-generator';
import { getPortProcess, isCLIProxyProcess } from '../utils/port-utils';
import { CLIPROXY_DEFAULT_PORT } from './config-generator';

/** Session lock file structure */
interface SessionLock {
  port: number;
  pid: number;
  sessions: string[];
  startedAt: string;
}

/** Generate unique session ID */
function generateSessionId(): string {
  return crypto.randomBytes(8).toString('hex');
}

/** Get path to session lock file */
function getSessionLockPath(): string {
  return path.join(getCliproxyDir(), 'sessions.json');
}

/** Read session lock file (returns null if not exists or invalid) */
function readSessionLock(): SessionLock | null {
  const lockPath = getSessionLockPath();
  try {
    if (!fs.existsSync(lockPath)) {
      return null;
    }
    const content = fs.readFileSync(lockPath, 'utf-8');
    const lock = JSON.parse(content) as SessionLock;
    // Validate structure
    if (
      typeof lock.port !== 'number' ||
      typeof lock.pid !== 'number' ||
      !Array.isArray(lock.sessions)
    ) {
      return null;
    }
    return lock;
  } catch {
    return null;
  }
}

/** Write session lock file */
function writeSessionLock(lock: SessionLock): void {
  const lockPath = getSessionLockPath();
  const dir = path.dirname(lockPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2), { mode: 0o600 });
}

/** Delete session lock file */
function deleteSessionLock(): void {
  const lockPath = getSessionLockPath();
  try {
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  } catch {
    // Ignore errors on cleanup
  }
}

/** Check if a PID is still running */
function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 checks if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if there's an existing proxy running that we can reuse.
 * Returns the existing lock if proxy is healthy, null otherwise.
 */
export function getExistingProxy(port: number): SessionLock | null {
  const lock = readSessionLock();
  if (!lock) {
    return null;
  }

  // Verify port matches
  if (lock.port !== port) {
    return null;
  }

  // Verify proxy process is still running
  if (!isProcessRunning(lock.pid)) {
    // Proxy crashed - clean up stale lock
    deleteSessionLock();
    return null;
  }

  return lock;
}

/**
 * Register a new session with the proxy.
 * Call this when starting a new CCS session that will use an existing proxy.
 * @returns Session ID for this session
 */
export function registerSession(port: number, proxyPid: number): string {
  const sessionId = generateSessionId();
  const existingLock = readSessionLock();

  if (existingLock && existingLock.port === port && existingLock.pid === proxyPid) {
    // Add to existing sessions
    existingLock.sessions.push(sessionId);
    writeSessionLock(existingLock);
  } else {
    // Create new lock (first session for this proxy)
    const newLock: SessionLock = {
      port,
      pid: proxyPid,
      sessions: [sessionId],
      startedAt: new Date().toISOString(),
    };
    writeSessionLock(newLock);
  }

  return sessionId;
}

/**
 * Unregister a session from the proxy.
 * @returns true if this was the last session (proxy should be killed)
 */
export function unregisterSession(sessionId: string): boolean {
  const lock = readSessionLock();
  if (!lock) {
    // No lock file - assume we're the only session
    return true;
  }

  // Remove this session from the list
  const index = lock.sessions.indexOf(sessionId);
  if (index !== -1) {
    lock.sessions.splice(index, 1);
  }

  // Check if any sessions remain
  if (lock.sessions.length === 0) {
    // Last session - clean up lock file
    deleteSessionLock();
    return true;
  }

  // Other sessions still active - keep proxy running
  writeSessionLock(lock);
  return false;
}

/**
 * Get current session count for the proxy.
 */
export function getSessionCount(): number {
  const lock = readSessionLock();
  if (!lock) {
    return 0;
  }
  return lock.sessions.length;
}

/**
 * Check if proxy has any active sessions.
 * Used to determine if a "zombie" proxy should be killed.
 */
export function hasActiveSessions(): boolean {
  const lock = readSessionLock();
  if (!lock) {
    return false;
  }

  // Verify proxy is still running
  if (!isProcessRunning(lock.pid)) {
    deleteSessionLock();
    return false;
  }

  return lock.sessions.length > 0;
}

/**
 * Clean up orphaned sessions (when proxy crashes).
 * Called on startup to ensure clean state.
 */
export function cleanupOrphanedSessions(port: number): void {
  const lock = readSessionLock();
  if (!lock) {
    return;
  }

  // If port doesn't match, this lock is for a different proxy
  if (lock.port !== port) {
    return;
  }

  // If proxy is dead, clean up lock
  if (!isProcessRunning(lock.pid)) {
    deleteSessionLock();
  }
}

/**
 * Stop the CLIProxy process and clean up session lock.
 * Falls back to port-based detection if no session lock exists.
 * @returns Object with success status and details
 */
export async function stopProxy(): Promise<{
  stopped: boolean;
  pid?: number;
  sessionCount?: number;
  error?: string;
}> {
  const lock = readSessionLock();

  if (!lock) {
    // No session lock - try to find process by port (legacy/untracked proxy)
    const portProcess = await getPortProcess(CLIPROXY_DEFAULT_PORT);

    if (!portProcess) {
      return { stopped: false, error: 'No active CLIProxy session found' };
    }

    if (!isCLIProxyProcess(portProcess)) {
      return {
        stopped: false,
        error: `Port ${CLIPROXY_DEFAULT_PORT} is in use by ${portProcess.processName}, not CLIProxy`,
      };
    }

    // Found CLIProxy running without session lock - kill it
    try {
      process.kill(portProcess.pid, 'SIGTERM');
      return { stopped: true, pid: portProcess.pid, sessionCount: 0 };
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ESRCH') {
        return { stopped: false, error: 'CLIProxy process already terminated' };
      }
      return { stopped: false, pid: portProcess.pid, error: `Failed to stop: ${error.message}` };
    }
  }

  // Check if proxy is running
  if (!isProcessRunning(lock.pid)) {
    deleteSessionLock();
    return { stopped: false, error: 'CLIProxy was not running (cleaned up stale lock)' };
  }

  const sessionCount = lock.sessions.length;
  const pid = lock.pid;

  try {
    // Kill the proxy process
    process.kill(pid, 'SIGTERM');

    // Clean up session lock
    deleteSessionLock();

    return { stopped: true, pid, sessionCount };
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ESRCH') {
      // Process already gone
      deleteSessionLock();
      return { stopped: false, error: 'CLIProxy process already terminated' };
    }
    return { stopped: false, pid, error: `Failed to stop: ${error.message}` };
  }
}

/**
 * Get proxy status information.
 */
export function getProxyStatus(): {
  running: boolean;
  port?: number;
  pid?: number;
  sessionCount?: number;
  startedAt?: string;
} {
  const lock = readSessionLock();

  if (!lock) {
    return { running: false };
  }

  // Verify proxy is still running
  if (!isProcessRunning(lock.pid)) {
    deleteSessionLock();
    return { running: false };
  }

  return {
    running: true,
    port: lock.port,
    pid: lock.pid,
    sessionCount: lock.sessions.length,
    startedAt: lock.startedAt,
  };
}
