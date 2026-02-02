/**
 * Unit tests for weighted round-robin sync module
 * Tests the interleaved distribution algorithm (s{NNN} naming)
 */

import { describe, test, expect } from 'bun:test';
import { generateWeightedFiles } from '../../src/cliproxy/weighted-round-robin-sync';
import { AccountInfo } from '../../src/cliproxy/account-manager';
import { CLIProxyProvider } from '../../src/cliproxy/types';

const provider: CLIProxyProvider = 'agy';

function makeAccount(id: string, weight: number, paused = false): AccountInfo {
  return {
    id,
    provider,
    isDefault: false,
    tokenFile: `agy-${id.split('@')[0]}.json`,
    createdAt: '2025-01-01T00:00:00Z',
    weight,
    paused,
  };
}

describe('generateWeightedFiles', () => {
  test('handles empty accounts', () => {
    const result = generateWeightedFiles([], provider);
    expect(result).toEqual([]);
  });

  test('handles paused accounts', () => {
    const accounts = [makeAccount('test@example.com', 2, true)];
    const result = generateWeightedFiles(accounts, provider);
    expect(result).toEqual([]);
  });

  test('single account with weight 1', () => {
    const accounts = [makeAccount('alice@example.com', 1)];
    const result = generateWeightedFiles(accounts, provider);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('antigravity-s000_alice@example.com.json');
    expect(result[0].sequence).toBe(0);
    expect(result[0].accountId).toBe('alice@example.com');
  });

  test('single account with weight 3', () => {
    const accounts = [makeAccount('ultra@example.com', 3)];
    const result = generateWeightedFiles(accounts, provider);
    expect(result).toHaveLength(3);
    expect(result[0].filename).toBe('antigravity-s000_ultra@example.com.json');
    expect(result[1].filename).toBe('antigravity-s001_ultra@example.com.json');
    expect(result[2].filename).toBe('antigravity-s002_ultra@example.com.json');
  });

  test('handles default weight of 1', () => {
    const accounts: AccountInfo[] = [
      {
        id: 'default@example.com',
        provider,
        isDefault: true,
        tokenFile: 'agy-default.json',
        createdAt: '2025-01-01T00:00:00Z',
        // No weight field — defaults to 1
      },
    ];
    const result = generateWeightedFiles(accounts, provider);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('antigravity-s000_default@example.com.json');
  });

  test('skips accounts with weight 0', () => {
    const accounts = [makeAccount('active@example.com', 1), makeAccount('disabled@example.com', 0)];
    const result = generateWeightedFiles(accounts, provider);
    expect(result).toHaveLength(1);
    expect(result[0].accountId).toBe('active@example.com');
  });

  test('interleaves high and low weight accounts', () => {
    const accounts = [
      makeAccount('ultra@example.com', 3),
      makeAccount('pro1@example.com', 1),
      makeAccount('pro2@example.com', 1),
      makeAccount('pro3@example.com', 1),
    ];
    const result = generateWeightedFiles(accounts, provider);

    // Total: 3 + 1 + 1 + 1 = 6 slots
    expect(result).toHaveLength(6);

    // All accounts present with correct counts
    const ids = result.map((f) => f.accountId);
    expect(ids.filter((id) => id === 'ultra@example.com')).toHaveLength(3);
    expect(ids.filter((id) => id === 'pro1@example.com')).toHaveLength(1);
    expect(ids.filter((id) => id === 'pro2@example.com')).toHaveLength(1);
    expect(ids.filter((id) => id === 'pro3@example.com')).toHaveLength(1);

    // Pro accounts evenly spaced (not clustered at start or end)
    const proPositions = result
      .map((f, i) => ({ id: f.accountId, seq: i }))
      .filter((x) => x.id.startsWith('pro'))
      .map((x) => x.seq);

    // No two pro accounts adjacent
    for (let i = 1; i < proPositions.length; i++) {
      expect(proPositions[i] - proPositions[i - 1]).toBeGreaterThan(1);
    }
  });

  test('real-world scenario: 3 Ultra w=8, 13 Pro w=1', () => {
    const accounts = [
      makeAccount('ultra1@example.com', 8),
      makeAccount('ultra2@example.com', 8),
      makeAccount('ultra3@example.com', 8),
      ...Array.from({ length: 13 }, (_, i) => makeAccount(`pro${i + 1}@example.com`, 1)),
    ];
    const result = generateWeightedFiles(accounts, provider);

    // Total: 3*8 + 13*1 = 37 slots
    expect(result).toHaveLength(37);

    // All 16 accounts present
    const uniqueIds = new Set(result.map((f) => f.accountId));
    expect(uniqueIds.size).toBe(16);

    // Each Ultra appears 8 times, each Pro appears 1 time
    for (let i = 1; i <= 3; i++) {
      expect(result.filter((f) => f.accountId === `ultra${i}@example.com`)).toHaveLength(8);
    }
    for (let i = 1; i <= 13; i++) {
      expect(result.filter((f) => f.accountId === `pro${i}@example.com`)).toHaveLength(1);
    }

    // Filenames sorted alphabetically = sequence order
    const filenames = result.map((f) => f.filename);
    const sorted = [...filenames].sort();
    expect(filenames).toEqual(sorted);

    // Pro accounts are spread (not all at start or end)
    const proPositions = result
      .map((f, i) => ({ id: f.accountId, seq: i }))
      .filter((x) => x.id.startsWith('pro'))
      .map((x) => x.seq);
    // First pro should not be at position 24+ (i.e. should be within first third)
    expect(proPositions[0]).toBeLessThan(10);
    // Last pro should not be in first 10 positions
    expect(proPositions[proPositions.length - 1]).toBeGreaterThan(10);
  });

  test('all accounts same weight (round-robin all)', () => {
    const accounts = [makeAccount('a@example.com', 3), makeAccount('b@example.com', 3)];
    const result = generateWeightedFiles(accounts, provider);
    expect(result).toHaveLength(6);

    // Round-robin: a, b, a, b, a, b
    expect(result[0].accountId).toBe('a@example.com');
    expect(result[1].accountId).toBe('b@example.com');
    expect(result[2].accountId).toBe('a@example.com');
    expect(result[3].accountId).toBe('b@example.com');
  });

  test('only low-weight accounts (all weight=1)', () => {
    const accounts = [
      makeAccount('a@example.com', 1),
      makeAccount('b@example.com', 1),
      makeAccount('c@example.com', 1),
    ];
    const result = generateWeightedFiles(accounts, provider);
    expect(result).toHaveLength(3);
    const ids = new Set(result.map((f) => f.accountId));
    expect(ids.size).toBe(3);
  });

  test('deterministic output (same input = same output)', () => {
    const accounts = [
      makeAccount('ultra@example.com', 4),
      makeAccount('pro1@example.com', 1),
      makeAccount('pro2@example.com', 1),
    ];
    const result1 = generateWeightedFiles(accounts, provider);
    const result2 = generateWeightedFiles(accounts, provider);
    expect(result1).toEqual(result2);
  });

  test('sequence numbers are zero-padded to 3 digits', () => {
    const accounts = [makeAccount('a@example.com', 2)];
    const result = generateWeightedFiles(accounts, provider);
    expect(result[0].filename).toMatch(/antigravity-s\d{3}_/);
    expect(result[0].filename).toContain('-s000_');
    expect(result[1].filename).toContain('-s001_');
  });

  test('uses provider-specific prefix', () => {
    const accounts: AccountInfo[] = [
      {
        id: 'alice@example.com',
        provider: 'gemini',
        isDefault: true,
        tokenFile: 'gemini-alice.json',
        createdAt: '2025-01-01T00:00:00Z',
        weight: 1,
      },
    ];
    const result = generateWeightedFiles(accounts, 'gemini');
    expect(result[0].filename).toStartWith('gemini-s000_');
  });
});
