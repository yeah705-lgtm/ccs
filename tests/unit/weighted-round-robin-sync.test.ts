/**
 * Unit tests for weighted round-robin sync module
 */

import { describe, test, expect } from 'bun:test';
import { generateWeightedFiles } from '../../src/cliproxy/weighted-round-robin-sync';
import { AccountInfo } from '../../src/cliproxy/account-manager';
import { CLIProxyProvider } from '../../src/cliproxy/types';

describe('generateWeightedFiles', () => {
  const provider: CLIProxyProvider = 'agy';

  test('handles empty accounts', () => {
    const result = generateWeightedFiles([], provider);
    expect(result).toEqual([]);
  });

  test('handles paused accounts', () => {
    const accounts: AccountInfo[] = [
      {
        id: 'test@example.com',
        provider,
        isDefault: true,
        tokenFile: 'agy-test.json',
        createdAt: new Date().toISOString(),
        paused: true,
        weight: 2,
      },
    ];
    const result = generateWeightedFiles(accounts, provider);
    expect(result).toEqual([]);
  });

  test('generates single-round files with suffixes', () => {
    const accounts: AccountInfo[] = [
      {
        id: 'alice@example.com',
        provider,
        isDefault: true,
        tokenFile: 'agy-alice.json',
        createdAt: new Date().toISOString(),
        weight: 1,
      },
      {
        id: 'bob@example.com',
        provider,
        isDefault: false,
        tokenFile: 'agy-bob.json',
        createdAt: new Date().toISOString(),
        weight: 1,
      },
    ];
    const result = generateWeightedFiles(accounts, provider);

    // Should create 2 files (1 round each with suffix)
    expect(result).toHaveLength(2);
    expect(result[0].filename).toBe('antigravity-r01a_alice@example.com.json');
    expect(result[0].suffix).toBe('a');
    expect(result[0].round).toBe(1);
    expect(result[1].filename).toBe('antigravity-r01b_bob@example.com.json');
    expect(result[1].suffix).toBe('b');
    expect(result[1].round).toBe(1);
  });

  test('generates multi-round files without suffixes', () => {
    const accounts: AccountInfo[] = [
      {
        id: 'heavy@example.com',
        provider,
        isDefault: true,
        tokenFile: 'agy-heavy.json',
        createdAt: new Date().toISOString(),
        weight: 3,
      },
    ];
    const result = generateWeightedFiles(accounts, provider);

    // Should create 3 files (rounds 01-03, no suffix)
    expect(result).toHaveLength(3);
    expect(result[0].filename).toBe('antigravity-r01_heavy@example.com.json');
    expect(result[0].suffix).toBe('');
    expect(result[0].round).toBe(1);
    expect(result[1].filename).toBe('antigravity-r02_heavy@example.com.json');
    expect(result[1].suffix).toBe('');
    expect(result[1].round).toBe(2);
    expect(result[2].filename).toBe('antigravity-r03_heavy@example.com.json');
    expect(result[2].suffix).toBe('');
    expect(result[2].round).toBe(3);
  });

  test('distributes mixed weights correctly', () => {
    const accounts: AccountInfo[] = [
      {
        id: 'ultra@example.com',
        provider,
        isDefault: true,
        tokenFile: 'agy-ultra.json',
        createdAt: new Date().toISOString(),
        weight: 3,
      },
      {
        id: 'free1@example.com',
        provider,
        isDefault: false,
        tokenFile: 'agy-free1.json',
        createdAt: new Date().toISOString(),
        weight: 1,
      },
      {
        id: 'free2@example.com',
        provider,
        isDefault: false,
        tokenFile: 'agy-free2.json',
        createdAt: new Date().toISOString(),
        weight: 1,
      },
      {
        id: 'free3@example.com',
        provider,
        isDefault: false,
        tokenFile: 'agy-free3.json',
        createdAt: new Date().toISOString(),
        weight: 1,
      },
    ];
    const result = generateWeightedFiles(accounts, provider);

    // maxRounds = 3, prosPerRound = ceil(3/3) = 1
    // Round 1: ultra (no suffix) + free1 (suffix a)
    // Round 2: ultra (no suffix) + free2 (suffix a)
    // Round 3: ultra (no suffix) + free3 (suffix a)
    expect(result).toHaveLength(6);

    // Check round 1
    expect(result.filter((f) => f.round === 1)).toHaveLength(2);
    expect(result.find((f) => f.round === 1 && f.accountId === 'ultra@example.com')?.suffix).toBe('');
    expect(result.find((f) => f.round === 1 && f.accountId === 'free1@example.com')?.suffix).toBe('a');

    // Check round 2
    expect(result.filter((f) => f.round === 2)).toHaveLength(2);
    expect(result.find((f) => f.round === 2 && f.accountId === 'ultra@example.com')?.suffix).toBe('');
    expect(result.find((f) => f.round === 2 && f.accountId === 'free2@example.com')?.suffix).toBe('a');

    // Check round 3
    expect(result.filter((f) => f.round === 3)).toHaveLength(2);
    expect(result.find((f) => f.round === 3 && f.accountId === 'ultra@example.com')?.suffix).toBe('');
    expect(result.find((f) => f.round === 3 && f.accountId === 'free3@example.com')?.suffix).toBe('a');
  });

  test('handles default weight of 1', () => {
    const accounts: AccountInfo[] = [
      {
        id: 'default@example.com',
        provider,
        isDefault: true,
        tokenFile: 'agy-default.json',
        createdAt: new Date().toISOString(),
        // No weight specified, should default to 1
      },
    ];
    const result = generateWeightedFiles(accounts, provider);

    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('antigravity-r01a_default@example.com.json');
    expect(result[0].suffix).toBe('a');
  });

  test('skips accounts with weight 0', () => {
    const accounts: AccountInfo[] = [
      {
        id: 'active@example.com',
        provider,
        isDefault: true,
        tokenFile: 'agy-active.json',
        createdAt: new Date().toISOString(),
        weight: 1,
      },
      {
        id: 'disabled@example.com',
        provider,
        isDefault: false,
        tokenFile: 'agy-disabled.json',
        createdAt: new Date().toISOString(),
        weight: 0,
      },
    ];
    const result = generateWeightedFiles(accounts, provider);

    // Only active account should be included
    expect(result).toHaveLength(1);
    expect(result[0].accountId).toBe('active@example.com');
  });
});
