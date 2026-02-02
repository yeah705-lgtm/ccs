/**
 * Weighted Round-Robin Sync - Filesystem Integration Tests
 *
 * Tests syncWeightedAuthFiles() with REAL filesystem operations.
 * Uses process.env.CCS_HOME for test isolation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  rmSync,
} from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  syncWeightedAuthFiles,
  generateWeightedFiles,
  SyncResult,
  WeightedFile,
} from '../../../src/cliproxy/weighted-round-robin-sync';
import type { AccountInfo } from '../../../src/cliproxy/account-manager';
import type { CLIProxyProvider } from '../../../src/cliproxy/types';

// Test environment setup
interface TestEnv {
  tmpDir: string;
  ccsDir: string;
  cliproxyDir: string;
  authDir: string;
  cleanup: () => void;
}

function createTestEnv(): TestEnv {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ccs-wrr-sync-'));
  const ccsDir = path.join(tmpDir, '.ccs');
  const cliproxyDir = path.join(ccsDir, 'cliproxy');
  const authDir = path.join(cliproxyDir, 'auth');
  mkdirSync(authDir, { recursive: true });

  const originalCcsHome = process.env.CCS_HOME;

  process.env.CCS_HOME = tmpDir;

  return {
    tmpDir,
    ccsDir,
    cliproxyDir,
    authDir,
    cleanup: () => {
      process.env.CCS_HOME = originalCcsHome;
      rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

function writeRegistry(cliproxyDir: string, registry: object) {
  writeFileSync(path.join(cliproxyDir, 'accounts.json'), JSON.stringify(registry, null, 2));
}

function writeTokenFile(authDir: string, filename: string, email: string) {
  writeFileSync(path.join(authDir, filename), JSON.stringify({ email, type: 'antigravity' }));
}

function writeMigrationMarker(cliproxyDir: string, provider: string) {
  const migrationDir = path.join(cliproxyDir, 'migration');
  mkdirSync(migrationDir, { recursive: true });
  writeFileSync(
    path.join(migrationDir, `.weight-migration-v1-${provider}`),
    new Date().toISOString()
  );
}

function writeMigrationMarkerV2(cliproxyDir: string, provider: string) {
  const migrationDir = path.join(cliproxyDir, 'migration');
  mkdirSync(migrationDir, { recursive: true });
  writeFileSync(
    path.join(migrationDir, `.weight-migration-v2-${provider}`),
    new Date().toISOString()
  );
}

function readRegistry(cliproxyDir: string): object {
  const content = readFileSync(path.join(cliproxyDir, 'accounts.json'), 'utf-8');
  return JSON.parse(content);
}

// Test fixtures
function createSingleWeightAccount(
  email: string,
  tokenFile: string,
  provider: CLIProxyProvider = 'agy'
): AccountInfo {
  return {
    id: email,
    provider,
    isDefault: true,
    tokenFile,
    createdAt: '2025-01-01T00:00:00Z',
    weight: 1,
    email,
  };
}

function createMultiWeightAccount(
  email: string,
  tokenFile: string,
  weight: number,
  provider: CLIProxyProvider = 'agy'
): AccountInfo {
  return {
    id: email,
    provider,
    isDefault: true,
    tokenFile,
    createdAt: '2025-01-01T00:00:00Z',
    weight,
    email,
  };
}

describe('syncWeightedAuthFiles - file creation', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    env.cleanup();
  });

  test('creates weighted files for single-weight accounts (s000_, s001_ pattern)', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    // Setup registry with 2 accounts, weight=1 each
    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
            'bob@example.com': {
              tokenFile: 'antigravity-bob_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);
    writeTokenFile(env.authDir, 'antigravity-alice_example_com.json', 'alice@example.com');
    writeTokenFile(env.authDir, 'antigravity-bob_example_com.json', 'bob@example.com');

    const result = await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    expect(result.created.length).toBe(2);
    expect(result.created).toContain('antigravity-s000_alice@example.com.json');
    expect(result.created).toContain('antigravity-s001_bob@example.com.json');

    const files = readdirSync(env.authDir);
    expect(files).toContain('antigravity-s000_alice@example.com.json');
    expect(files).toContain('antigravity-s001_bob@example.com.json');
  });

  test('creates weighted files for multi-weight accounts (s000_, s001_, s002_ pattern)', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    // Account with weight=3 should appear in s000, s001, s002
    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'charlie@example.com',
          accounts: {
            'charlie@example.com': {
              tokenFile: 'antigravity-charlie_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 3,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);
    writeTokenFile(env.authDir, 'antigravity-charlie_example_com.json', 'charlie@example.com');

    const result = await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    expect(result.created.length).toBe(3);
    expect(result.created).toContain('antigravity-s000_charlie@example.com.json');
    expect(result.created).toContain('antigravity-s001_charlie@example.com.json');
    expect(result.created).toContain('antigravity-s002_charlie@example.com.json');
  });

  test('creates weighted files for mixed weights (interleaves low-weight evenly)', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    // Mix: alice w=2, bob w=1. Total 3 slots. Bob at position floor(0*3/1)=0, Alice fills 1,2
    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 2,
            },
            'bob@example.com': {
              tokenFile: 'antigravity-bob_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);
    writeTokenFile(env.authDir, 'antigravity-alice_example_com.json', 'alice@example.com');
    writeTokenFile(env.authDir, 'antigravity-bob_example_com.json', 'bob@example.com');

    const result = await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    expect(result.created.length).toBe(3);
    // Bob (low-weight) appears at position 0
    expect(result.created).toContain('antigravity-s000_bob@example.com.json');
    // Alice fills remaining positions 1, 2
    expect(result.created).toContain('antigravity-s001_alice@example.com.json');
    expect(result.created).toContain('antigravity-s002_alice@example.com.json');
  });

  test('copies canonical token content to weighted files', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);

    const tokenContent = JSON.stringify({
      email: 'alice@example.com',
      type: 'antigravity',
      token: 'secret',
    });
    writeFileSync(path.join(env.authDir, 'antigravity-alice_example_com.json'), tokenContent);

    await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    const weightedPath = path.join(env.authDir, 'antigravity-s000_alice@example.com.json');
    const weightedContent = readFileSync(weightedPath, 'utf-8');
    expect(weightedContent).toBe(tokenContent);
  });

  test('uses antigravity prefix for agy provider', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);
    writeTokenFile(env.authDir, 'antigravity-alice_example_com.json', 'alice@example.com');

    await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    const files = readdirSync(env.authDir);
    const weightedFile = files.find((f) => f.startsWith('antigravity-s'));
    expect(weightedFile).toBeDefined();
  });

  test('uses provider name as prefix for non-agy providers (e.g. gemini)', async () => {
    writeMigrationMarker(env.cliproxyDir, 'gemini');
    writeMigrationMarkerV2(env.cliproxyDir, 'gemini');

    const registry = {
      version: 1,
      providers: {
        gemini: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'gemini-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);
    writeTokenFile(env.authDir, 'gemini-alice_example_com.json', 'alice@example.com');

    await syncWeightedAuthFiles('gemini', { skipMigrationCheck: true });

    const files = readdirSync(env.authDir);
    const weightedFile = files.find((f) => f.startsWith('gemini-s'));
    expect(weightedFile).toBeDefined();
  });
});

describe('syncWeightedAuthFiles - file removal', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    env.cleanup();
  });

  test('removes obsolete weighted files not in target list', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    // Setup: 2 accounts initially
    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);
    writeTokenFile(env.authDir, 'antigravity-alice_example_com.json', 'alice@example.com');

    // Create obsolete weighted file (from removed account)
    writeFileSync(
      path.join(env.authDir, 'antigravity-s000_bob@example.com.json'),
      JSON.stringify({ email: 'bob@example.com', type: 'antigravity' })
    );

    const result = await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    expect(result.removed).toContain('antigravity-s000_bob@example.com.json');
    expect(existsSync(path.join(env.authDir, 'antigravity-s000_bob@example.com.json'))).toBe(false);
  });

  test('removes all weighted files when no active accounts', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    // Empty accounts registry
    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'default',
          accounts: {},
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);

    // Create some weighted files
    writeFileSync(
      path.join(env.authDir, 'antigravity-s000_alice@example.com.json'),
      JSON.stringify({ email: 'alice@example.com', type: 'antigravity' })
    );
    writeFileSync(
      path.join(env.authDir, 'antigravity-s001_bob@example.com.json'),
      JSON.stringify({ email: 'bob@example.com', type: 'antigravity' })
    );

    const result = await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    expect(result.removed.length).toBe(2);
    expect(readdirSync(env.authDir).filter((f) => f.startsWith('antigravity-s')).length).toBe(0);
  });

  test('does not remove weighted files that match target list', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);
    writeTokenFile(env.authDir, 'antigravity-alice_example_com.json', 'alice@example.com');

    // Pre-create the weighted file
    writeFileSync(
      path.join(env.authDir, 'antigravity-s000_alice@example.com.json'),
      JSON.stringify({ email: 'alice@example.com', type: 'antigravity' })
    );

    const result = await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    expect(result.removed).not.toContain('antigravity-s000_alice@example.com.json');
    expect(result.unchanged).toBe(1);
  });
});

describe('syncWeightedAuthFiles - canonical backup', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    env.cleanup();
  });

  test('moves old canonical file to auth-backup/ when weighted file has same content', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);

    const tokenContent = JSON.stringify({ email: 'alice@example.com', type: 'antigravity' });
    writeFileSync(path.join(env.authDir, 'antigravity-alice_example_com.json'), tokenContent);

    await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    const backupDir = path.join(env.cliproxyDir, 'auth-backup');
    expect(existsSync(backupDir)).toBe(true);
    expect(existsSync(path.join(backupDir, 'antigravity-alice_example_com.json'))).toBe(true);
    expect(existsSync(path.join(env.authDir, 'antigravity-alice_example_com.json'))).toBe(false);
  });

  test('updates registry tokenFile to point to weighted file after backup', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);
    writeTokenFile(env.authDir, 'antigravity-alice_example_com.json', 'alice@example.com');

    await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    const updatedRegistry: any = readRegistry(env.cliproxyDir);
    expect(updatedRegistry.providers.agy.accounts['alice@example.com'].tokenFile).toBe(
      'antigravity-s000_alice@example.com.json'
    );
  });

  test('skips backup when canonical is already s{NNN} format', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    // Canonical is already weighted format
    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-s000_alice@example.com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);
    writeTokenFile(env.authDir, 'antigravity-s000_alice@example.com.json', 'alice@example.com');

    await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    const backupDir = path.join(env.cliproxyDir, 'auth-backup');
    // No backup directory created
    expect(existsSync(backupDir)).toBe(false);
  });

  test('skips backup when weighted file content differs from canonical', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);

    const canonicalContent = JSON.stringify({
      email: 'alice@example.com',
      type: 'antigravity',
      version: 1,
    });
    writeFileSync(path.join(env.authDir, 'antigravity-alice_example_com.json'), canonicalContent);

    // Pre-create weighted file with different content
    const weightedContent = JSON.stringify({
      email: 'alice@example.com',
      type: 'antigravity',
      version: 2,
    });
    writeFileSync(
      path.join(env.authDir, 'antigravity-s000_alice@example.com.json'),
      weightedContent
    );

    await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    // Canonical file not moved (content differs)
    expect(existsSync(path.join(env.authDir, 'antigravity-alice_example_com.json'))).toBe(true);
  });

  test('creates auth-backup directory if not exists', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);
    writeTokenFile(env.authDir, 'antigravity-alice_example_com.json', 'alice@example.com');

    const backupDir = path.join(env.cliproxyDir, 'auth-backup');
    expect(existsSync(backupDir)).toBe(false);

    await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    expect(existsSync(backupDir)).toBe(true);
  });
});

describe('syncWeightedAuthFiles - edge cases', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    env.cleanup();
  });

  test('handles missing canonical token file gracefully', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    // Registry points to non-existent token file
    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-missing.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);

    const result = await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    // No files created (missing canonical)
    expect(result.created.length).toBe(0);
  });

  test('handles empty auth directory', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);

    // Auth dir is empty (no token files)
    const result = await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    expect(result.created.length).toBe(0);
  });

  test('handles missing auth directory (creates it)', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    // Remove auth directory
    rmSync(env.authDir, { recursive: true });
    expect(existsSync(env.authDir)).toBe(false);

    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'default',
          accounts: {},
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);

    await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    expect(existsSync(env.authDir)).toBe(true);
  });

  test('idempotent - running sync twice produces same result', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 2,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);
    writeTokenFile(env.authDir, 'antigravity-alice_example_com.json', 'alice@example.com');

    const result1 = await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });
    const result2 = await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    expect(result1.created.length).toBe(2);
    expect(result2.created.length).toBe(0);
    expect(result2.unchanged).toBe(2);
  });

  test('returns correct SyncResult counts', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);
    writeTokenFile(env.authDir, 'antigravity-alice_example_com.json', 'alice@example.com');

    // Create obsolete file
    writeFileSync(
      path.join(env.authDir, 'antigravity-s999_bob@example.com.json'),
      JSON.stringify({ email: 'bob@example.com', type: 'antigravity' })
    );

    const result = await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    expect(result.created.length).toBe(1);
    expect(result.removed.length).toBeGreaterThanOrEqual(1);
    expect(result.unchanged).toBe(0);
  });

  test('skipMigrationCheck option prevents migration check', async () => {
    // Don't write migration marker - migration would run without skipMigrationCheck

    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);
    writeTokenFile(env.authDir, 'antigravity-alice_example_com.json', 'alice@example.com');

    // Should not throw even without migration marker
    const result = await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });
    expect(result).toBeDefined();
  });
});

describe('syncWeightedAuthFiles - provider prefix mapping', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    env.cleanup();
  });

  test('agy → antigravity prefix', async () => {
    writeMigrationMarker(env.cliproxyDir, 'agy');
    writeMigrationMarkerV2(env.cliproxyDir, 'agy');

    const registry = {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);
    writeTokenFile(env.authDir, 'antigravity-alice_example_com.json', 'alice@example.com');

    await syncWeightedAuthFiles('agy', { skipMigrationCheck: true });

    const files = readdirSync(env.authDir).filter((f) => f.startsWith('antigravity-s'));
    expect(files.length).toBeGreaterThan(0);
  });

  test('gemini → gemini prefix', async () => {
    writeMigrationMarker(env.cliproxyDir, 'gemini');
    writeMigrationMarkerV2(env.cliproxyDir, 'gemini');

    const registry = {
      version: 1,
      providers: {
        gemini: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'gemini-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);
    writeTokenFile(env.authDir, 'gemini-alice_example_com.json', 'alice@example.com');

    await syncWeightedAuthFiles('gemini', { skipMigrationCheck: true });

    const files = readdirSync(env.authDir).filter((f) => f.startsWith('gemini-s'));
    expect(files.length).toBeGreaterThan(0);
  });

  test('codex → codex prefix', async () => {
    writeMigrationMarker(env.cliproxyDir, 'codex');
    writeMigrationMarkerV2(env.cliproxyDir, 'codex');

    const registry = {
      version: 1,
      providers: {
        codex: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'codex-alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    };
    writeRegistry(env.cliproxyDir, registry);
    writeTokenFile(env.authDir, 'codex-alice_example_com.json', 'alice@example.com');

    await syncWeightedAuthFiles('codex', { skipMigrationCheck: true });

    const files = readdirSync(env.authDir).filter((f) => f.startsWith('codex-s'));
    expect(files.length).toBeGreaterThan(0);
  });
});
