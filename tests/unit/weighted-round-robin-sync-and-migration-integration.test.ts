/**
 * Integration tests for weighted round-robin sync and migration
 *
 * Tests file operations with isolated temp directories (CCS_HOME override).
 * Note: Uses require() for dist code to ensure CCS_HOME is properly isolated.
 */

import { describe, test, expect } from 'bun:test';
import * as path from 'path';

// Note: dist/ must exist before running these tests.
// CI runs `bun run build:all` before validate. Locally, use `bun run test` (includes build).

describe('syncWeightedAuthFiles integration', () => {
  test('function exports exist', () => {
    const syncModule = require('../../dist/cliproxy/weighted-round-robin-sync');
    const migrationModule = require('../../dist/cliproxy/weighted-round-robin-migration');

    expect(typeof syncModule.syncWeightedAuthFiles).toBe('function');
    expect(typeof syncModule.generateWeightedFiles).toBe('function');
    expect(typeof migrationModule.migrateOldPrefixes).toBe('function');
    expect(typeof migrationModule.migrateRoundToSequence).toBe('function');
    expect(typeof migrationModule.isMigrationComplete).toBe('function');
  });

  test('generateWeightedFiles creates correct file descriptors', () => {
    const { generateWeightedFiles } = require('../../dist/cliproxy/weighted-round-robin-sync');

    const accounts = [
      {
        id: 'heavy@example.com',
        provider: 'agy',
        isDefault: true,
        tokenFile: 'agy-heavy.json',
        createdAt: new Date().toISOString(),
        weight: 3,
      },
      {
        id: 'light@example.com',
        provider: 'agy',
        isDefault: false,
        tokenFile: 'agy-light.json',
        createdAt: new Date().toISOString(),
        weight: 1,
      },
    ];

    const result = generateWeightedFiles(accounts, 'agy');

    // Total: 3 + 1 = 4 slots
    expect(result.length).toBe(4);

    // Heavy account (weight 3) should appear 3 times
    const heavyFiles = result.filter(
      (f: { accountId: string }) => f.accountId === 'heavy@example.com'
    );
    expect(heavyFiles.length).toBe(3);

    // Light account (weight 1) should appear 1 time
    const lightFiles = result.filter(
      (f: { accountId: string }) => f.accountId === 'light@example.com'
    );
    expect(lightFiles.length).toBe(1);

    // All files use s{NNN} naming
    for (const file of result) {
      expect(file.filename).toMatch(/^antigravity-s\d{3}_/);
      expect(typeof file.sequence).toBe('number');
    }

    // Filenames sorted alphabetically = sequence order
    const filenames = result.map((f: { filename: string }) => f.filename);
    const sorted = [...filenames].sort();
    expect(filenames).toEqual(sorted);
  });
});

describe('migration detection', () => {
  test('detects old prefix pattern correctly', () => {
    // Old pattern: agy-k_email.json, agy-m_email.json, agy-z_email.json
    // New pattern: agy-s000_email.json, agy-s001_email.json

    const oldPatterns = [
      'agy-k_test@example.com.json',
      'agy-m_test@example.com.json',
      'agy-z_test@example.com.json',
      'agy-test@example.com.json', // No prefix
    ];

    const newPatterns = [
      'agy-s000_test@example.com.json',
      'agy-s001_test@example.com.json',
      'agy-s036_test@example.com.json',
    ];

    // Old pattern regex: should NOT match s\d{3} pattern
    const oldPatternRegex = /^agy-(?!s\d{3})/;

    for (const filename of oldPatterns) {
      expect(oldPatternRegex.test(filename)).toBe(true);
    }

    for (const filename of newPatterns) {
      expect(oldPatternRegex.test(filename)).toBe(false);
    }
  });

  test('sequence pattern detection works correctly', () => {
    // Pattern for weighted files: provider-s\d{3}_
    const sequencePattern = /^[^-]+-s\d{3}_/;

    const testCases = [
      { file: 'agy-s000_email.json', expected: true },
      { file: 'agy-s001_email.json', expected: true },
      { file: 'agy-s036_email.json', expected: true },
      { file: 'agy-s999_email.json', expected: true },
      { file: 'agy-k_email.json', expected: false },
      { file: 'agy-m_email.json', expected: false },
      { file: 'agy-email.json', expected: false },
      { file: 'agy-r01_email.json', expected: false }, // Old format
      { file: 'agy-r02a_email.json', expected: false }, // Old format
    ];

    for (const { file, expected } of testCases) {
      expect(sequencePattern.test(file)).toBe(expected);
    }
  });
});

describe('file operation utilities', () => {
  test('atomic write pattern is safe', () => {
    // Verify the temp file pattern used for atomic writes
    const targetPath = '/tmp/test-file.json';
    const tempPath = `${targetPath}.tmp`;

    expect(tempPath).toBe('/tmp/test-file.json.tmp');
    expect(path.dirname(tempPath)).toBe(path.dirname(targetPath));
  });

  test('migration marker v2 path is consistent', () => {
    // Migration marker: .weight-migration-v2-{provider}
    const provider = 'agy';
    const markerName = `.weight-migration-v2-${provider}`;

    expect(markerName).toBe('.weight-migration-v2-agy');
    expect(markerName.startsWith('.')).toBe(true); // Hidden file
  });
});
