/**
 * Health Check Service (Phase 06)
 *
 * Runs comprehensive health checks for CCS dashboard matching `ccs doctor` output.
 * Groups: System, Configuration, Profiles & Delegation, System Health, CLIProxy
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { getCcsDir, getConfigPath } from '../utils/config-manager';
import {
  isCLIProxyInstalled,
  getInstalledCliproxyVersion,
  getCLIProxyPath,
  getConfigPath as getCliproxyConfigPath,
  getAllAuthStatus,
  CLIPROXY_DEFAULT_PORT,
} from '../cliproxy';
import { getClaudeCliInfo } from '../utils/claude-detector';
import { getPortProcess, isCLIProxyProcess } from '../utils/port-utils';
import packageJson from '../../package.json';

export interface HealthCheck {
  id: string;
  name: string;
  status: 'ok' | 'warning' | 'error' | 'info';
  message: string;
  details?: string;
  fix?: string;
  fixable?: boolean;
}

export interface HealthGroup {
  id: string;
  name: string;
  icon: string;
  checks: HealthCheck[];
}

export interface HealthReport {
  timestamp: number;
  version: string;
  groups: HealthGroup[];
  checks: HealthCheck[]; // Flat list for backward compatibility
  summary: {
    total: number;
    passed: number;
    warnings: number;
    errors: number;
    info: number;
  };
}

/**
 * Run all health checks and return report
 */
export async function runHealthChecks(): Promise<HealthReport> {
  const homedir = os.homedir();
  const ccsDir = getCcsDir();
  const claudeDir = path.join(homedir, '.claude');
  const version = packageJson.version;

  const groups: HealthGroup[] = [];

  // Group 1: System
  const systemChecks: HealthCheck[] = [];
  systemChecks.push(await checkClaudeCli());
  systemChecks.push(checkCcsDirectory(ccsDir));
  groups.push({ id: 'system', name: 'System', icon: 'Monitor', checks: systemChecks });

  // Group 2: Configuration
  const configChecks: HealthCheck[] = [];
  configChecks.push(checkConfigFile());
  configChecks.push(...checkSettingsFiles(ccsDir));
  configChecks.push(checkClaudeSettings(claudeDir));
  groups.push({
    id: 'configuration',
    name: 'Configuration',
    icon: 'Settings',
    checks: configChecks,
  });

  // Group 3: Profiles & Delegation
  const profileChecks: HealthCheck[] = [];
  profileChecks.push(checkProfiles(ccsDir));
  profileChecks.push(checkInstances(ccsDir));
  profileChecks.push(checkDelegation(ccsDir));
  groups.push({
    id: 'profiles',
    name: 'Profiles & Delegation',
    icon: 'Users',
    checks: profileChecks,
  });

  // Group 4: System Health
  const healthChecks: HealthCheck[] = [];
  healthChecks.push(checkPermissions(ccsDir));
  healthChecks.push(checkCcsSymlinks());
  healthChecks.push(checkSettingsSymlinks(homedir, ccsDir, claudeDir));
  groups.push({
    id: 'system-health',
    name: 'System Health',
    icon: 'Shield',
    checks: healthChecks,
  });

  // Group 5: CLIProxy
  const cliproxyChecks: HealthCheck[] = [];
  cliproxyChecks.push(checkCliproxyBinary());
  cliproxyChecks.push(checkCliproxyConfig());
  cliproxyChecks.push(...checkOAuthProviders());
  cliproxyChecks.push(await checkCliproxyPort());
  groups.push({
    id: 'cliproxy',
    name: 'CLIProxy (OAuth)',
    icon: 'Zap',
    checks: cliproxyChecks,
  });

  // Flatten all checks for backward compatibility
  const allChecks = groups.flatMap((g) => g.checks);

  // Calculate summary
  const summary = {
    total: allChecks.length,
    passed: allChecks.filter((c) => c.status === 'ok').length,
    warnings: allChecks.filter((c) => c.status === 'warning').length,
    errors: allChecks.filter((c) => c.status === 'error').length,
    info: allChecks.filter((c) => c.status === 'info').length,
  };

  return {
    timestamp: Date.now(),
    version,
    groups,
    checks: allChecks,
    summary,
  };
}

// Check 1: Claude CLI
async function checkClaudeCli(): Promise<HealthCheck> {
  const cliInfo = getClaudeCliInfo();

  if (!cliInfo) {
    return {
      id: 'claude-cli',
      name: 'Claude CLI',
      status: 'error',
      message: 'Not found in PATH',
      fix: 'Install: npm install -g @anthropic-ai/claude-code',
    };
  }

  try {
    const version = execSync('claude --version', {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const versionMatch = version.match(/(\d+\.\d+\.\d+)/);
    const versionStr = versionMatch ? versionMatch[1] : 'unknown';

    return {
      id: 'claude-cli',
      name: 'Claude CLI',
      status: 'ok',
      message: `v${versionStr}`,
      details: cliInfo.path,
    };
  } catch {
    return {
      id: 'claude-cli',
      name: 'Claude CLI',
      status: 'error',
      message: 'Not working',
      details: cliInfo.path,
      fix: 'Reinstall Claude CLI',
    };
  }
}

// Check 2: CCS Directory
function checkCcsDirectory(ccsDir: string): HealthCheck {
  if (fs.existsSync(ccsDir)) {
    return {
      id: 'ccs-dir',
      name: 'CCS Directory',
      status: 'ok',
      message: 'Exists',
      details: '~/.ccs/',
    };
  }

  return {
    id: 'ccs-dir',
    name: 'CCS Directory',
    status: 'error',
    message: 'Not found',
    details: ccsDir,
    fix: 'Run: npm install -g @kaitranntt/ccs --force',
    fixable: true,
  };
}

// Check 3: Config file
function checkConfigFile(): HealthCheck {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    return {
      id: 'config-file',
      name: 'config.json',
      status: 'warning',
      message: 'Not found',
      details: configPath,
      fixable: true,
    };
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    JSON.parse(content);
    return {
      id: 'config-file',
      name: 'config.json',
      status: 'ok',
      message: 'Valid',
      details: configPath,
    };
  } catch {
    return {
      id: 'config-file',
      name: 'config.json',
      status: 'error',
      message: 'Invalid JSON',
      details: configPath,
    };
  }
}

// Check 4: Settings files (glm, kimi)
function checkSettingsFiles(ccsDir: string): HealthCheck[] {
  const checks: HealthCheck[] = [];
  const files = [
    { name: 'glm.settings.json', profile: 'glm' },
    { name: 'kimi.settings.json', profile: 'kimi' },
  ];

  const { DelegationValidator } = require('../utils/delegation-validator');

  for (const file of files) {
    const filePath = path.join(ccsDir, file.name);

    if (!fs.existsSync(filePath)) {
      checks.push({
        id: `settings-${file.profile}`,
        name: file.name,
        status: 'info',
        message: 'Not configured',
        details: filePath,
      });
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      JSON.parse(content);

      const validation = DelegationValidator.validate(file.profile);

      if (validation.valid) {
        checks.push({
          id: `settings-${file.profile}`,
          name: file.name,
          status: 'ok',
          message: 'Key configured',
          details: filePath,
        });
      } else if (validation.error && validation.error.includes('placeholder')) {
        checks.push({
          id: `settings-${file.profile}`,
          name: file.name,
          status: 'warning',
          message: 'Placeholder key',
          details: filePath,
        });
      } else {
        checks.push({
          id: `settings-${file.profile}`,
          name: file.name,
          status: 'ok',
          message: 'Valid JSON',
          details: filePath,
        });
      }
    } catch {
      checks.push({
        id: `settings-${file.profile}`,
        name: file.name,
        status: 'error',
        message: 'Invalid JSON',
        details: filePath,
      });
    }
  }

  return checks;
}

// Check 5: Claude settings
function checkClaudeSettings(claudeDir: string): HealthCheck {
  const settingsPath = path.join(claudeDir, 'settings.json');

  if (!fs.existsSync(settingsPath)) {
    return {
      id: 'claude-settings',
      name: '~/.claude/settings.json',
      status: 'warning',
      message: 'Not found',
      fix: 'Run: claude /login',
    };
  }

  try {
    const content = fs.readFileSync(settingsPath, 'utf8');
    JSON.parse(content);
    return {
      id: 'claude-settings',
      name: '~/.claude/settings.json',
      status: 'ok',
      message: 'Valid',
    };
  } catch {
    return {
      id: 'claude-settings',
      name: '~/.claude/settings.json',
      status: 'warning',
      message: 'Invalid JSON',
      fix: 'Run: claude /login',
    };
  }
}

// Check 6: Profiles
function checkProfiles(ccsDir: string): HealthCheck {
  const configPath = path.join(ccsDir, 'config.json');

  if (!fs.existsSync(configPath)) {
    return {
      id: 'profiles',
      name: 'Profiles',
      status: 'info',
      message: 'config.json not found',
    };
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (!config.profiles || typeof config.profiles !== 'object') {
      return {
        id: 'profiles',
        name: 'Profiles',
        status: 'error',
        message: 'Missing profiles object',
        fix: 'Run: npm install -g @kaitranntt/ccs --force',
      };
    }

    const profileCount = Object.keys(config.profiles).length;
    const profileNames = Object.keys(config.profiles).join(', ');

    return {
      id: 'profiles',
      name: 'Profiles',
      status: 'ok',
      message: `${profileCount} configured`,
      details: profileNames.length > 40 ? profileNames.substring(0, 37) + '...' : profileNames,
    };
  } catch (e) {
    return {
      id: 'profiles',
      name: 'Profiles',
      status: 'error',
      message: (e as Error).message,
    };
  }
}

// Check 7: Instances
function checkInstances(ccsDir: string): HealthCheck {
  const instancesDir = path.join(ccsDir, 'instances');

  if (!fs.existsSync(instancesDir)) {
    return {
      id: 'instances',
      name: 'Instances',
      status: 'ok',
      message: 'No account profiles',
    };
  }

  const instances = fs.readdirSync(instancesDir).filter((name) => {
    return fs.statSync(path.join(instancesDir, name)).isDirectory();
  });

  if (instances.length === 0) {
    return {
      id: 'instances',
      name: 'Instances',
      status: 'ok',
      message: 'No account profiles',
    };
  }

  return {
    id: 'instances',
    name: 'Instances',
    status: 'ok',
    message: `${instances.length} account profile${instances.length !== 1 ? 's' : ''}`,
  };
}

// Check 8: Delegation
function checkDelegation(ccsDir: string): HealthCheck {
  const ccsClaudeCommandsDir = path.join(ccsDir, '.claude', 'commands');
  const hasCcsCommand = fs.existsSync(path.join(ccsClaudeCommandsDir, 'ccs.md'));
  const hasContinueCommand = fs.existsSync(path.join(ccsClaudeCommandsDir, 'ccs', 'continue.md'));

  if (!hasCcsCommand || !hasContinueCommand) {
    return {
      id: 'delegation',
      name: 'Delegation',
      status: 'warning',
      message: 'Not installed',
      fix: 'Run: npm install -g @kaitranntt/ccs --force',
    };
  }

  const { DelegationValidator } = require('../utils/delegation-validator');
  const readyProfiles: string[] = [];

  for (const profile of ['glm', 'kimi']) {
    const validation = DelegationValidator.validate(profile);
    if (validation.valid) {
      readyProfiles.push(profile);
    }
  }

  if (readyProfiles.length === 0) {
    return {
      id: 'delegation',
      name: 'Delegation',
      status: 'warning',
      message: 'No profiles ready',
      fix: 'Configure profiles with valid API keys',
    };
  }

  return {
    id: 'delegation',
    name: 'Delegation',
    status: 'ok',
    message: `${readyProfiles.length} profiles ready`,
    details: readyProfiles.join(', '),
  };
}

// Check 9: Permissions
function checkPermissions(ccsDir: string): HealthCheck {
  const testFile = path.join(ccsDir, '.permission-test');

  try {
    fs.writeFileSync(testFile, 'test', 'utf8');
    fs.unlinkSync(testFile);
    return {
      id: 'permissions',
      name: 'Permissions',
      status: 'ok',
      message: 'Write access verified',
    };
  } catch {
    return {
      id: 'permissions',
      name: 'Permissions',
      status: 'error',
      message: 'Cannot write to ~/.ccs/',
      fix: 'sudo chown -R $USER ~/.ccs ~/.claude && chmod 755 ~/.ccs ~/.claude',
    };
  }
}

// Check 10: CCS Symlinks
function checkCcsSymlinks(): HealthCheck {
  try {
    const { ClaudeSymlinkManager } = require('../utils/claude-symlink-manager');
    const manager = new ClaudeSymlinkManager();
    const health = manager.checkHealth();

    if (health.healthy) {
      const itemCount = manager.ccsItems.length;
      return {
        id: 'ccs-symlinks',
        name: 'CCS Symlinks',
        status: 'ok',
        message: `${itemCount}/${itemCount} items linked`,
      };
    }

    return {
      id: 'ccs-symlinks',
      name: 'CCS Symlinks',
      status: 'warning',
      message: `${health.issues.length} issues found`,
      fix: 'Run: ccs sync',
    };
  } catch (e) {
    return {
      id: 'ccs-symlinks',
      name: 'CCS Symlinks',
      status: 'warning',
      message: 'Could not check',
      details: (e as Error).message,
      fix: 'Run: ccs sync',
    };
  }
}

// Check 11: Settings Symlinks
function checkSettingsSymlinks(homedir: string, ccsDir: string, claudeDir: string): HealthCheck {
  try {
    const sharedDir = path.join(homedir, '.ccs', 'shared');
    const sharedSettings = path.join(sharedDir, 'settings.json');
    const claudeSettings = path.join(claudeDir, 'settings.json');

    if (!fs.existsSync(sharedSettings)) {
      return {
        id: 'settings-symlinks',
        name: 'settings.json',
        status: 'warning',
        message: 'Shared not found',
        fix: 'Run: ccs sync',
      };
    }

    const sharedStats = fs.lstatSync(sharedSettings);
    if (!sharedStats.isSymbolicLink()) {
      return {
        id: 'settings-symlinks',
        name: 'settings.json',
        status: 'warning',
        message: 'Not a symlink',
        fix: 'Run: ccs sync',
      };
    }

    const sharedTarget = fs.readlinkSync(sharedSettings);
    const resolvedShared = path.resolve(path.dirname(sharedSettings), sharedTarget);

    if (resolvedShared !== claudeSettings) {
      return {
        id: 'settings-symlinks',
        name: 'settings.json',
        status: 'warning',
        message: 'Wrong target',
        fix: 'Run: ccs sync',
      };
    }

    // Check instances
    const instancesDir = path.join(ccsDir, 'instances');
    if (!fs.existsSync(instancesDir)) {
      return {
        id: 'settings-symlinks',
        name: 'settings.json',
        status: 'ok',
        message: 'Shared symlink valid',
      };
    }

    const instances = fs.readdirSync(instancesDir).filter((name) => {
      return fs.statSync(path.join(instancesDir, name)).isDirectory();
    });

    let broken = 0;
    for (const instance of instances) {
      const instanceSettings = path.join(instancesDir, instance, 'settings.json');
      if (!fs.existsSync(instanceSettings)) {
        broken++;
        continue;
      }
      try {
        const stats = fs.lstatSync(instanceSettings);
        if (!stats.isSymbolicLink()) {
          broken++;
          continue;
        }
        const target = fs.readlinkSync(instanceSettings);
        const resolved = path.resolve(path.dirname(instanceSettings), target);
        if (resolved !== sharedSettings) {
          broken++;
        }
      } catch {
        broken++;
      }
    }

    if (broken > 0) {
      return {
        id: 'settings-symlinks',
        name: 'settings.json',
        status: 'warning',
        message: `${broken} broken instance(s)`,
        fix: 'Run: ccs sync',
      };
    }

    return {
      id: 'settings-symlinks',
      name: 'settings.json',
      status: 'ok',
      message: `${instances.length} instance(s) valid`,
    };
  } catch (e) {
    return {
      id: 'settings-symlinks',
      name: 'settings.json',
      status: 'warning',
      message: 'Check failed',
      details: (e as Error).message,
      fix: 'Run: ccs sync',
    };
  }
}

// Check 12: CLIProxy Binary
function checkCliproxyBinary(): HealthCheck {
  if (isCLIProxyInstalled()) {
    const version = getInstalledCliproxyVersion();
    const binaryPath = getCLIProxyPath();
    return {
      id: 'cliproxy-binary',
      name: 'CLIProxy Binary',
      status: 'ok',
      message: `v${version}`,
      details: binaryPath,
    };
  }

  return {
    id: 'cliproxy-binary',
    name: 'CLIProxy Binary',
    status: 'info',
    message: 'Not installed',
    details: 'Downloads on first use',
  };
}

// Check 13: CLIProxy Config
function checkCliproxyConfig(): HealthCheck {
  const configPath = getCliproxyConfigPath();

  if (fs.existsSync(configPath)) {
    return {
      id: 'cliproxy-config',
      name: 'CLIProxy Config',
      status: 'ok',
      message: 'cliproxy/config.yaml',
    };
  }

  return {
    id: 'cliproxy-config',
    name: 'CLIProxy Config',
    status: 'info',
    message: 'Not created',
    details: 'Generated on first use',
  };
}

// Check 14: OAuth Providers
function checkOAuthProviders(): HealthCheck[] {
  const authStatuses = getAllAuthStatus();
  const checks: HealthCheck[] = [];

  for (const status of authStatuses) {
    const providerName = status.provider.charAt(0).toUpperCase() + status.provider.slice(1);

    if (status.authenticated) {
      const lastAuth = status.lastAuth ? status.lastAuth.toLocaleDateString() : '';
      checks.push({
        id: `oauth-${status.provider}`,
        name: `${providerName} Auth`,
        status: 'ok',
        message: 'Authenticated',
        details: lastAuth,
      });
    } else {
      checks.push({
        id: `oauth-${status.provider}`,
        name: `${providerName} Auth`,
        status: 'info',
        message: 'Not authenticated',
        fix: `Run: ccs ${status.provider} --auth`,
      });
    }
  }

  return checks;
}

// Check 15: CLIProxy Port
async function checkCliproxyPort(): Promise<HealthCheck> {
  const portProcess = await getPortProcess(CLIPROXY_DEFAULT_PORT);

  if (!portProcess) {
    return {
      id: 'cliproxy-port',
      name: 'CLIProxy Port',
      status: 'info',
      message: `${CLIPROXY_DEFAULT_PORT} free`,
      details: 'Proxy not running',
    };
  }

  if (isCLIProxyProcess(portProcess)) {
    return {
      id: 'cliproxy-port',
      name: 'CLIProxy Port',
      status: 'ok',
      message: 'CLIProxy running',
      details: `PID ${portProcess.pid}`,
    };
  }

  return {
    id: 'cliproxy-port',
    name: 'CLIProxy Port',
    status: 'warning',
    message: `Occupied by ${portProcess.processName}`,
    details: `PID ${portProcess.pid}`,
    fix: `Kill process: kill ${portProcess.pid}`,
  };
}

/**
 * Fix a health issue by its check ID
 */
export function fixHealthIssue(checkId: string): { success: boolean; message: string } {
  const ccsDir = getCcsDir();

  switch (checkId) {
    case 'ccs-dir':
      fs.mkdirSync(ccsDir, { recursive: true });
      return { success: true, message: 'Created ~/.ccs directory' };

    case 'config-file': {
      const configPath = getConfigPath();
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify({ profiles: {} }, null, 2) + '\n');
      return { success: true, message: 'Created config.json' };
    }

    case 'profiles-file': {
      const profilesPath = path.join(ccsDir, 'profiles.json');
      fs.mkdirSync(ccsDir, { recursive: true });
      fs.writeFileSync(profilesPath, JSON.stringify({ profiles: {} }, null, 2) + '\n');
      return { success: true, message: 'Created profiles.json' };
    }

    default:
      return { success: false, message: 'Cannot auto-fix this issue' };
  }
}
