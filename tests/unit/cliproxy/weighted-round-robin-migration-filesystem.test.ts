/**
 * Comprehensive filesystem-based tests for weighted round-robin migration module
 *
 * Tests use REAL filesystem with CCS_HOME env var for isolation.
 * Each test creates temp directories and verifies actual file operations.
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
  statSync,
} from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  isMigrationComplete,
  migrateOldPrefixes,
} from '../../../src/cliproxy/weighted-round-robin-migration';
import type { MigrationResult } from '../../../src/cliproxy/weighted-round-robin-shared-types';

/** Test environment helper */
interface TestEnv {
  tmpDir: string;
  ccsDir: string;
  cliproxyDir: string;
  authDir: string;
  cleanup: () => void;
}

/** Create isolated test environment with CCS_HOME override */
function createTestEnv(): TestEnv {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ccs-wrr-mig-'));
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

/** Write accounts.json registry */
function writeRegistry(cliproxyDir: string, data: object): void {
  writeFileSync(path.join(cliproxyDir, 'accounts.json'), JSON.stringify(data, null, 2));
}

/** Read accounts.json registry */
function readRegistry(cliproxyDir: string): object {
  const content = readFileSync(path.join(cliproxyDir, 'accounts.json'), 'utf-8');
  return JSON.parse(content);
}

/** Write token file with email */
function writeTokenFile(authDir: string, filename: string, email: string): void {
  writeFileSync(path.join(authDir, filename), JSON.stringify({ email, type: 'antigravity' }));
}

/** Write token file without email (invalid) */
function writeInvalidTokenFile(authDir: string, filename: string): void {
  writeFileSync(path.join(authDir, filename), JSON.stringify({ type: 'antigravity' }));
}

/** Write malformed JSON */
function writeMalformedTokenFile(authDir: string, filename: string): void {
  writeFileSync(path.join(authDir, filename), '{invalid json');
}

/** Check if migration marker exists */
function markerExists(cliproxyDir: string, provider: string): boolean {
  return existsSync(path.join(cliproxyDir, 'migration', `.weight-migration-v1-${provider}`));
}

/** List all files in auth directory */
function listAuthFiles(authDir: string): string[] {
  if (!existsSync(authDir)) return [];
  return readdirSync(authDir).filter((f) => f.endsWith('.json'));
}

let testEnv: TestEnv;

beforeEach(() => {
  testEnv = createTestEnv();
});

afterEach(() => {
  testEnv.cleanup();
});

describe('isMigrationComplete', () => {
  test('returns false when no marker exists', () => {
    expect(isMigrationComplete('agy')).toBe(false);
  });

  test('returns false when only v1 marker exists (v2 required)', () => {
    const migrationDir = path.join(testEnv.cliproxyDir, 'migration');
    mkdirSync(migrationDir, { recursive: true });
    const v1Marker = path.join(migrationDir, '.weight-migration-v1-agy');
    writeFileSync(v1Marker, new Date().toISOString());
    // v2 not present — migration not complete
    expect(isMigrationComplete('agy')).toBe(false);
  });

  test('returns true when v2 marker exists', () => {
    const migrationDir = path.join(testEnv.cliproxyDir, 'migration');
    mkdirSync(migrationDir, { recursive: true });
    const v2Marker = path.join(migrationDir, '.weight-migration-v2-agy');
    writeFileSync(v2Marker, new Date().toISOString());
    expect(isMigrationComplete('agy')).toBe(true);
  });

  test('checks correct provider marker (not cross-provider)', () => {
    const migrationDir = path.join(testEnv.cliproxyDir, 'migration');
    mkdirSync(migrationDir, { recursive: true });
    const agyMarker = path.join(migrationDir, '.weight-migration-v2-agy');
    writeFileSync(agyMarker, new Date().toISOString());

    expect(isMigrationComplete('agy')).toBe(true);
    expect(isMigrationComplete('codex')).toBe(false);
  });
});

describe('migrateOldPrefixes - detection', () => {
  test('detects k_ prefix files', async () => {
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-k_alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
            },
          },
        },
      },
    });

    writeTokenFile(testEnv.authDir, 'antigravity-k_alice_example_com.json', 'alice@example.com');
    writeTokenFile(testEnv.authDir, 'antigravity-alice_example_com.json', 'alice@example.com');

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(1);
    expect(result.skipped).toBe(false);
  });

  test('detects m_ prefix files', async () => {
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: {
        agy: {
          default: 'bob@example.com',
          accounts: {
            'bob@example.com': {
              tokenFile: 'antigravity-m_bob_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
            },
          },
        },
      },
    });

    writeTokenFile(testEnv.authDir, 'antigravity-m_bob_example_com.json', 'bob@example.com');

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(1);
  });

  test('detects z_ prefix files', async () => {
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: {
        agy: {
          default: 'charlie@example.com',
          accounts: {
            'charlie@example.com': {
              tokenFile: 'antigravity-z_charlie_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
            },
          },
        },
      },
    });

    writeTokenFile(
      testEnv.authDir,
      'antigravity-z_charlie_example_com.json',
      'charlie@example.com'
    );

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(1);
  });

  test('detects no-prefix files (just provider-email pattern)', async () => {
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: {
        agy: {
          default: 'dave@example.com',
          accounts: {
            'dave@example.com': {
              tokenFile: 'antigravity-dave_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
            },
          },
        },
      },
    });

    writeTokenFile(testEnv.authDir, 'antigravity-dave_example_com.json', 'dave@example.com');

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(1);
  });

  test('ignores already-weighted r{NN} files', async () => {
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: {
        agy: {
          default: 'eve@example.com',
          accounts: {
            'eve@example.com': {
              tokenFile: 'antigravity-r01_eve_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    });

    writeTokenFile(testEnv.authDir, 'antigravity-r01_eve_example_com.json', 'eve@example.com');

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(0);
    expect(result.skipped).toBe(false);
  });

  test('ignores files from other providers', async () => {
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: {
        agy: {
          default: 'frank@example.com',
          accounts: {
            'frank@example.com': {
              tokenFile: 'antigravity-frank_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
            },
          },
        },
      },
    });

    writeTokenFile(testEnv.authDir, 'antigravity-frank_example_com.json', 'frank@example.com');
    writeTokenFile(testEnv.authDir, 'gemini-grace_example_com.json', 'grace@example.com');

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(1);
  });

  test('ignores non-JSON files', async () => {
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: { agy: { default: 'test@example.com', accounts: {} } },
    });

    writeFileSync(path.join(testEnv.authDir, 'antigravity-readme.txt'), 'not json');

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(0);
  });

  test('skips files without email in JSON content', async () => {
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: { agy: { default: 'test@example.com', accounts: {} } },
    });

    writeInvalidTokenFile(testEnv.authDir, 'antigravity-noemail.json');

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(0);
  });

  test('skips files with invalid JSON', async () => {
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: { agy: { default: 'test@example.com', accounts: {} } },
    });

    writeMalformedTokenFile(testEnv.authDir, 'antigravity-malformed.json');

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(0);
  });
});

describe('migrateOldPrefixes - grouping and weights', () => {
  test('single file per email -> weight 1', async () => {
    const canonicalFile = 'antigravity-alice_example_com.json';
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: canonicalFile,
              createdAt: '2025-01-01T00:00:00Z',
            },
          },
        },
      },
    });

    writeTokenFile(testEnv.authDir, canonicalFile, 'alice@example.com');

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(1);

    const registry = readRegistry(testEnv.cliproxyDir) as {
      providers: { agy: { accounts: Record<string, { weight?: number }> } };
    };
    expect(registry.providers.agy.accounts['alice@example.com'].weight).toBe(1);
  });

  test('multiple files per email -> weight = count (k_ + m_ + z_ = weight 3)', async () => {
    const canonicalFile = 'antigravity-k_bob_example_com.json';
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: {
        agy: {
          default: 'bob@example.com',
          accounts: {
            'bob@example.com': {
              tokenFile: canonicalFile,
              createdAt: '2025-01-01T00:00:00Z',
            },
          },
        },
      },
    });

    writeTokenFile(testEnv.authDir, 'antigravity-k_bob_example_com.json', 'bob@example.com');
    writeTokenFile(testEnv.authDir, 'antigravity-m_bob_example_com.json', 'bob@example.com');
    writeTokenFile(testEnv.authDir, 'antigravity-z_bob_example_com.json', 'bob@example.com');

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(1);

    const registry = readRegistry(testEnv.cliproxyDir) as {
      providers: { agy: { accounts: Record<string, { weight?: number }> } };
    };
    expect(registry.providers.agy.accounts['bob@example.com'].weight).toBe(3);
  });

  test('mixed: some emails have duplicates, some do not', async () => {
    const aliceCanonical = 'antigravity-k_alice_example_com.json';
    const bobCanonical = 'antigravity-bob_example_com.json';
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: aliceCanonical,
              createdAt: '2025-01-01T00:00:00Z',
            },
            'bob@example.com': {
              tokenFile: bobCanonical,
              createdAt: '2025-01-01T00:00:00Z',
            },
          },
        },
      },
    });

    writeTokenFile(testEnv.authDir, 'antigravity-k_alice_example_com.json', 'alice@example.com');
    writeTokenFile(testEnv.authDir, 'antigravity-m_alice_example_com.json', 'alice@example.com');
    writeTokenFile(testEnv.authDir, 'antigravity-bob_example_com.json', 'bob@example.com');

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(2);

    const registry = readRegistry(testEnv.cliproxyDir) as {
      providers: { agy: { accounts: Record<string, { weight?: number }> } };
    };
    expect(registry.providers.agy.accounts['alice@example.com'].weight).toBe(2);
    expect(registry.providers.agy.accounts['bob@example.com'].weight).toBe(1);
  });
});

describe('migrateOldPrefixes - registry updates', () => {
  test('updates weight in registry for existing accounts', async () => {
    const canonicalFile = 'antigravity-k_alice_example_com.json';
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: canonicalFile,
              createdAt: '2025-01-01T00:00:00Z',
            },
          },
        },
      },
    });

    writeTokenFile(testEnv.authDir, 'antigravity-k_alice_example_com.json', 'alice@example.com');
    writeTokenFile(testEnv.authDir, 'antigravity-m_alice_example_com.json', 'alice@example.com');

    await migrateOldPrefixes('agy');

    const registry = readRegistry(testEnv.cliproxyDir) as {
      providers: { agy: { accounts: Record<string, { weight?: number }> } };
    };
    expect(registry.providers.agy.accounts['alice@example.com'].weight).toBe(2);
  });

  test('auto-registers unknown accounts discovered from auth files', async () => {
    const canonicalFile = 'antigravity-alice_example_com.json';
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: canonicalFile,
              createdAt: '2025-01-01T00:00:00Z',
            },
          },
        },
      },
    });

    writeTokenFile(testEnv.authDir, 'antigravity-alice_example_com.json', 'alice@example.com');
    writeTokenFile(testEnv.authDir, 'antigravity-orphan_example_com.json', 'orphan@example.com');

    const result = await migrateOldPrefixes('agy');
    // Orphan account should be auto-registered, not failed
    expect(result.failedWeightUpdates).toEqual([]);
    expect(result.migrated).toBe(2);

    // Verify orphan was registered in the registry
    const registry = readRegistry(testEnv.cliproxyDir) as {
      providers: { agy: { accounts: Record<string, unknown> } };
    };
    expect(registry.providers.agy.accounts['orphan@example.com']).toBeDefined();
  });

  test('migrates all accounts even when registry is completely empty', async () => {
    // Empty registry — simulates stale entry cleanup scenario
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: {},
    });

    writeTokenFile(testEnv.authDir, 'antigravity-alice_example_com.json', 'alice@example.com');
    writeTokenFile(testEnv.authDir, 'antigravity-bob_example_com.json', 'bob@example.com');

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(2);
    expect(result.failedWeightUpdates).toEqual([]);
  });
});

describe('migrateOldPrefixes - skip conditions', () => {
  test('skips when migration already complete (returns skipped: true)', async () => {
    const migrationDir = path.join(testEnv.cliproxyDir, 'migration');
    mkdirSync(migrationDir, { recursive: true });
    const markerPath = path.join(migrationDir, '.weight-migration-v1-agy');
    writeFileSync(markerPath, new Date().toISOString());

    const result = await migrateOldPrefixes('agy');
    expect(result.skipped).toBe(true);
    expect(result.migrated).toBe(0);
  });

  test('marks complete and returns migrated: 0 when no old files found', async () => {
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: 'antigravity-r01_alice_example_com.json',
              createdAt: '2025-01-01T00:00:00Z',
              weight: 1,
            },
          },
        },
      },
    });

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(0);
    expect(result.skipped).toBe(false);
    expect(markerExists(testEnv.cliproxyDir, 'agy')).toBe(true);
  });

  test('returns empty array when auth dir does not exist', async () => {
    rmSync(testEnv.authDir, { recursive: true });

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(0);
    expect(result.failedWeightUpdates).toEqual([]);
  });
});

describe('migrateOldPrefixes - end-to-end', () => {
  test('full migration: 3 accounts with k_/m_/z_ prefixes -> weighted files + old files removed + marker written', async () => {
    const aliceCanonical = 'antigravity-k_alice_example_com.json';
    const bobCanonical = 'antigravity-m_bob_example_com.json';
    const charlieCanonical = 'antigravity-z_charlie_example_com.json';
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: aliceCanonical,
              createdAt: '2025-01-01T00:00:00Z',
            },
            'bob@example.com': {
              tokenFile: bobCanonical,
              createdAt: '2025-01-01T00:00:00Z',
            },
            'charlie@example.com': {
              tokenFile: charlieCanonical,
              createdAt: '2025-01-01T00:00:00Z',
            },
          },
        },
      },
    });

    writeTokenFile(testEnv.authDir, 'antigravity-k_alice_example_com.json', 'alice@example.com');
    writeTokenFile(testEnv.authDir, 'antigravity-m_bob_example_com.json', 'bob@example.com');
    writeTokenFile(
      testEnv.authDir,
      'antigravity-z_charlie_example_com.json',
      'charlie@example.com'
    );

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(3);
    expect(result.skipped).toBe(false);
    expect(result.failedWeightUpdates).toEqual([]);

    const files = listAuthFiles(testEnv.authDir);
    // New s{NNN} files created
    expect(files.some((f) => /^antigravity-s\d{3}_/.test(f))).toBe(true);
    // Old prefix files removed
    expect(files.some((f) => f.includes('k_'))).toBe(false);
    expect(files.some((f) => f.includes('m_'))).toBe(false);
    expect(files.some((f) => f.includes('z_'))).toBe(false);

    expect(markerExists(testEnv.cliproxyDir, 'agy')).toBe(true);
  });

  test('partial migration: some accounts in registry, some not -> successful accounts migrated, failures tracked', async () => {
    const canonicalFile = 'antigravity-k_alice_example_com.json';
    writeRegistry(testEnv.cliproxyDir, {
      version: 1,
      providers: {
        agy: {
          default: 'alice@example.com',
          accounts: {
            'alice@example.com': {
              tokenFile: canonicalFile,
              createdAt: '2025-01-01T00:00:00Z',
            },
          },
        },
      },
    });

    writeTokenFile(testEnv.authDir, 'antigravity-k_alice_example_com.json', 'alice@example.com');
    writeTokenFile(testEnv.authDir, 'antigravity-orphan_example_com.json', 'orphan@example.com');

    const result = await migrateOldPrefixes('agy');
    expect(result.migrated).toBe(2);
    // Orphan auto-registered, no failures
    expect(result.failedWeightUpdates).toEqual([]);

    const files = listAuthFiles(testEnv.authDir);
    expect(files.some((f) => /^antigravity-s\d{3}_alice@example\.com/.test(f))).toBe(true);
    expect(files.some((f) => /^antigravity-s\d{3}_orphan@example\.com/.test(f))).toBe(true);
    expect(markerExists(testEnv.cliproxyDir, 'agy')).toBe(true);
  });
});
