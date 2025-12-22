/**
 * Binary Manager for CLIProxyAPI
 *
 * Facade pattern wrapper for modular binary management.
 * Pattern: Mirrors npm install behavior (fast check, download only when needed)
 */

import { info } from '../utils/ui';
import { getBinDir } from './config-generator';
import { BinaryInfo, BinaryManagerConfig } from './types';
import { CLIPROXY_FALLBACK_VERSION } from './platform-detector';
import {
  UpdateCheckResult,
  checkForUpdates,
  deleteBinary,
  getBinaryPath,
  isBinaryInstalled,
  getBinaryInfo,
  getPinnedVersion,
  savePinnedVersion,
  clearPinnedVersion,
  isVersionPinned,
  getVersionPinPath,
  readInstalledVersion,
  ensureBinary,
} from './binary';

/** Default configuration (uses CLIProxyAPIPlus fork with Kiro + Copilot support) */
const DEFAULT_CONFIG: BinaryManagerConfig = {
  version: CLIPROXY_FALLBACK_VERSION,
  releaseUrl: 'https://github.com/router-for-me/CLIProxyAPIPlus/releases/download',
  binPath: getBinDir(),
  maxRetries: 3,
  verbose: false,
  forceVersion: false,
};

/**
 * Binary Manager class for CLIProxyAPI binary lifecycle
 */
export class BinaryManager {
  private config: BinaryManagerConfig;

  constructor(config: Partial<BinaryManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Ensure binary is available (download if missing, update if outdated) */
  async ensureBinary(): Promise<string> {
    return ensureBinary(this.config);
  }

  /** Check for updates by comparing installed version with latest release */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    return checkForUpdates(this.config.binPath, this.config.version, this.config.verbose);
  }

  /** Get full path to binary executable */
  getBinaryPath(): string {
    return getBinaryPath(this.config.binPath);
  }

  /** Check if binary exists */
  isBinaryInstalled(): boolean {
    return isBinaryInstalled(this.config.binPath);
  }

  /** Get binary info if installed */
  async getBinaryInfo(): Promise<BinaryInfo | null> {
    return getBinaryInfo(this.config.binPath, this.config.version);
  }

  /** Delete binary (for cleanup or reinstall) */
  deleteBinary(): void {
    deleteBinary(this.config.binPath, this.config.verbose);
  }
}

/** Convenience function respecting version pin */
export async function ensureCLIProxyBinary(verbose = false): Promise<string> {
  const pinnedVersion = getPinnedVersion();
  if (pinnedVersion) {
    if (verbose) console.error(`[cliproxy] Using pinned version: ${pinnedVersion}`);
    return new BinaryManager({
      version: pinnedVersion,
      verbose,
      forceVersion: true,
    }).ensureBinary();
  }
  return new BinaryManager({ verbose }).ensureBinary();
}

/** Check if CLIProxyAPI binary is installed */
export function isCLIProxyInstalled(): boolean {
  return new BinaryManager().isBinaryInstalled();
}

/** Get CLIProxyAPI binary path (may not exist) */
export function getCLIProxyPath(): string {
  return new BinaryManager().getBinaryPath();
}

/** Get installed CLIProxyAPI version from .version file */
export function getInstalledCliproxyVersion(): string {
  return readInstalledVersion(getBinDir(), CLIPROXY_FALLBACK_VERSION);
}

/** Install a specific version of CLIProxyAPI */
export async function installCliproxyVersion(version: string, verbose = false): Promise<void> {
  const manager = new BinaryManager({ version, verbose, forceVersion: true });
  if (manager.isBinaryInstalled()) {
    if (verbose)
      console.log(info(`Removing existing CLIProxyAPI v${getInstalledCliproxyVersion()}`));
    manager.deleteBinary();
  }
  await manager.ensureBinary();
}

/** Fetch the latest CLIProxyAPI version from GitHub API */
export async function fetchLatestCliproxyVersion(): Promise<string> {
  const result = await new BinaryManager().checkForUpdates();
  return result.latestVersion;
}

/** Update check result for API response */
export interface CliproxyUpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  fromCache: boolean;
  checkedAt: number;
}

/** Check for CLIProxyAPI binary updates */
export async function checkCliproxyUpdate(): Promise<CliproxyUpdateCheckResult> {
  return new BinaryManager().checkForUpdates();
}

// Re-export version pin functions
export {
  getVersionPinPath,
  getPinnedVersion,
  savePinnedVersion,
  clearPinnedVersion,
  isVersionPinned,
};

export default BinaryManager;
