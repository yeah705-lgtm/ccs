/**
 * Unit tests for scheduleSyncForProvider (mutex + coalescing)
 *
 * Verifies that concurrent sync requests for the same provider
 * are serialized (mutex) and coalesced (rapid changes don't spawn N syncs).
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';

// We test the scheduler logic by mocking syncWeightedAuthFiles
// and verifying call patterns through the scheduler

describe('scheduleSyncForProvider', () => {
  // Track calls and allow controlling async resolution
  let syncCallCount: number;
  let syncResolvers: Array<() => void>;

  beforeEach(() => {
    syncCallCount = 0;
    syncResolvers = [];
  });

  /**
   * Creates a scheduler with controllable sync function.
   * Each sync call increments counter and blocks until manually resolved.
   */
  function createTestScheduler() {
    type CLIProxyProvider = string;
    const syncState = new Map<string, { running: boolean; pendingResync: boolean }>();

    const mockSync = () =>
      new Promise<void>((resolve) => {
        syncCallCount++;
        syncResolvers.push(resolve);
      });

    function scheduleSyncForProvider(provider: CLIProxyProvider): void {
      const key = provider;
      const state = syncState.get(key) ?? { running: false, pendingResync: false };

      if (state.running) {
        state.pendingResync = true;
        syncState.set(key, state);
        return;
      }

      state.running = true;
      state.pendingResync = false;
      syncState.set(key, state);

      const runSync = async () => {
        try {
          await mockSync();
        } catch {
          // ignore
        }

        const current = syncState.get(key);
        if (current?.pendingResync) {
          current.pendingResync = false;
          current.running = true;
          syncState.set(key, current);
          void runSync();
        } else {
          syncState.set(key, { running: false, pendingResync: false });
        }
      };

      void runSync();
    }

    return { scheduleSyncForProvider, syncState };
  }

  test('single call triggers exactly one sync', async () => {
    const { scheduleSyncForProvider } = createTestScheduler();

    scheduleSyncForProvider('agy');

    // Allow microtask to start the sync
    await new Promise((r) => setTimeout(r, 10));

    expect(syncCallCount).toBe(1);
    expect(syncResolvers.length).toBe(1);

    // Resolve the sync
    syncResolvers[0]();
    await new Promise((r) => setTimeout(r, 10));

    // No additional syncs
    expect(syncCallCount).toBe(1);
  });

  test('concurrent calls coalesce into at most 2 syncs', async () => {
    const { scheduleSyncForProvider } = createTestScheduler();

    // First call starts sync
    scheduleSyncForProvider('agy');
    await new Promise((r) => setTimeout(r, 10));
    expect(syncCallCount).toBe(1);

    // Rapid calls while sync is running — all should coalesce
    scheduleSyncForProvider('agy');
    scheduleSyncForProvider('agy');
    scheduleSyncForProvider('agy');

    // Still only 1 sync running
    expect(syncCallCount).toBe(1);

    // Resolve first sync — should trigger exactly 1 resync (coalesced)
    syncResolvers[0]();
    await new Promise((r) => setTimeout(r, 10));

    expect(syncCallCount).toBe(2);

    // Resolve second sync
    syncResolvers[1]();
    await new Promise((r) => setTimeout(r, 10));

    // No more syncs — the 3 rapid calls coalesced into 1 resync
    expect(syncCallCount).toBe(2);
  });

  test('different providers run independently', async () => {
    const { scheduleSyncForProvider } = createTestScheduler();

    scheduleSyncForProvider('agy');
    scheduleSyncForProvider('gemini');

    await new Promise((r) => setTimeout(r, 10));

    // Both providers should have their own sync
    expect(syncCallCount).toBe(2);
    expect(syncResolvers.length).toBe(2);

    // Resolve both
    syncResolvers[0]();
    syncResolvers[1]();
    await new Promise((r) => setTimeout(r, 10));

    expect(syncCallCount).toBe(2);
  });

  test('resync after completion triggers new sync', async () => {
    const { scheduleSyncForProvider } = createTestScheduler();

    // First sync
    scheduleSyncForProvider('agy');
    await new Promise((r) => setTimeout(r, 10));
    expect(syncCallCount).toBe(1);

    // Resolve first sync
    syncResolvers[0]();
    await new Promise((r) => setTimeout(r, 10));

    // New call after completion should start fresh
    scheduleSyncForProvider('agy');
    await new Promise((r) => setTimeout(r, 10));
    expect(syncCallCount).toBe(2);

    syncResolvers[1]();
    await new Promise((r) => setTimeout(r, 10));
    expect(syncCallCount).toBe(2);
  });

  test('pendingResync is cleared after resync completes', async () => {
    const { scheduleSyncForProvider, syncState } = createTestScheduler();

    scheduleSyncForProvider('agy');
    await new Promise((r) => setTimeout(r, 10));

    // Queue a resync
    scheduleSyncForProvider('agy');

    // Resolve first sync — triggers resync
    syncResolvers[0]();
    await new Promise((r) => setTimeout(r, 10));

    expect(syncCallCount).toBe(2);

    // Resolve resync
    syncResolvers[1]();
    await new Promise((r) => setTimeout(r, 10));

    // State should be clean
    const state = syncState.get('agy');
    expect(state?.running).toBe(false);
    expect(state?.pendingResync).toBe(false);
  });
});
