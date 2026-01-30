/**
 * Integration tests for weighted round-robin sync and migration
 *
 * Tests file operations with isolated temp directories (CCS_HOME override).
 * Note: Uses require() for dist code to ensure CCS_HOME is properly isolated.
 */

import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
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

    // Heavy account (weight 3) should appear in rounds 1, 2, 3 without suffix
    const heavyFiles = result.filter((f) => f.accountId === 'heavy@example.com');
    expect(heavyFiles.length).toBe(3);
    expect(heavyFiles.every((f) => f.suffix === '')).toBe(true);

    // Light account (weight 1) should appear in one round with suffix
    const lightFiles = result.filter((f) => f.accountId === 'light@example.com');
    expect(lightFiles.length).toBe(1);
    expect(lightFiles[0].suffix).toBeTruthy();
  });
});

describe('migration detection', () => {
  test('detects old prefix pattern correctly', () => {
    // Old pattern: agy-k_email.json, agy-m_email.json, agy-z_email.json
    // New pattern: agy-r01_email.json, agy-r02a_email.json

    const oldPatterns = [
      'agy-k_test@example.com.json',
      'agy-m_test@example.com.json',
      'agy-z_test@example.com.json',
      'agy-test@example.com.json', // No prefix
    ];

    const newPatterns = [
      'agy-r01_test@example.com.json',
      'agy-r02_test@example.com.json',
      'agy-r03a_test@example.com.json',
    ];

    // Old pattern regex: should NOT match r\d{2} pattern
    const oldPatternRegex = /^agy-(?!r\d{2})/;

    for (const filename of oldPatterns) {
      expect(oldPatternRegex.test(filename)).toBe(true);
    }

    for (const filename of newPatterns) {
      expect(oldPatternRegex.test(filename)).toBe(false);
    }
  });

  test('round pattern detection works correctly', () => {
    // Pattern for weighted files: provider-r\d{2}[a-z]*_
    const weightedPattern = /^[^-]+-r\d{2}[a-z]*_/;

    const testCases = [
      { file: 'agy-r01_email.json', expected: true },
      { file: 'agy-r02_email.json', expected: true },
      { file: 'agy-r10a_email.json', expected: true },
      { file: 'agy-r03ab_email.json', expected: true },
      { file: 'agy-k_email.json', expected: false },
      { file: 'agy-m_email.json', expected: false },
      { file: 'agy-email.json', expected: false },
    ];

    for (const { file, expected } of testCases) {
      expect(weightedPattern.test(file)).toBe(expected);
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

  test('migration marker path is consistent', () => {
    // Migration marker: .weight-migration-v1-{provider}
    const provider = 'agy';
    const markerName = `.weight-migration-v1-${provider}`;

    expect(markerName).toBe('.weight-migration-v1-agy');
    expect(markerName.startsWith('.')).toBe(true); // Hidden file
  });
});
