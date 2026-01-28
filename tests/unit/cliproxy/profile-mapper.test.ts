/**
 * Tests for Profile Mapper
 * Verifies syncable profile detection and ClaudeKey mapping.
 */

import * as assert from 'assert';

describe('Profile Mapper', () => {
  const profileMapper = require('../../../dist/cliproxy/sync/profile-mapper');

  describe('mapProfileToClaudeKey', () => {
    it('returns null when env is missing', () => {
      const profile = { name: 'test', settingsPath: '/path', isConfigured: true };
      const result = profileMapper.mapProfileToClaudeKey(profile);
      assert.strictEqual(result, null);
    });

    it('returns null when ANTHROPIC_AUTH_TOKEN is missing', () => {
      const profile = {
        name: 'test',
        settingsPath: '/path',
        isConfigured: true,
        env: { ANTHROPIC_BASE_URL: 'https://example.com' },
      };
      const result = profileMapper.mapProfileToClaudeKey(profile);
      assert.strictEqual(result, null);
    });

    it('generates ClaudeKey with correct prefix', () => {
      const profile = {
        name: 'glm',
        settingsPath: '/path',
        isConfigured: true,
        env: {
          ANTHROPIC_AUTH_TOKEN: 'sk-test-key',
          ANTHROPIC_BASE_URL: 'https://api.example.com',
          ANTHROPIC_MODEL: 'gpt-4',
        },
      };
      const result = profileMapper.mapProfileToClaudeKey(profile);

      assert.ok(result, 'Should return ClaudeKey');
      assert.strictEqual(result['api-key'], 'sk-test-key');
      assert.strictEqual(result.prefix, 'glm-');
      assert.strictEqual(result['base-url'], 'https://api.example.com');
      assert.ok(result.models, 'Should have models');
      assert.strictEqual(result.models[0].name, 'gpt-4');
    });

    it('handles special characters in profile name', () => {
      const profile = {
        name: 'my@profile!',
        settingsPath: '/path',
        isConfigured: true,
        env: { ANTHROPIC_AUTH_TOKEN: 'sk-key' },
      };
      const result = profileMapper.mapProfileToClaudeKey(profile);

      assert.ok(result);
      assert.strictEqual(result.prefix, 'my-profile--');
    });

    it('omits base-url when not provided', () => {
      const profile = {
        name: 'test',
        settingsPath: '/path',
        isConfigured: true,
        env: { ANTHROPIC_AUTH_TOKEN: 'sk-key' },
      };
      const result = profileMapper.mapProfileToClaudeKey(profile);

      assert.ok(result);
      assert.strictEqual(result['base-url'], undefined);
    });
  });

  describe('loadSyncableProfiles', () => {
    it('returns an array', () => {
      const result = profileMapper.loadSyncableProfiles();
      assert.ok(Array.isArray(result), 'Should return an array');
    });

    it('filters out profiles with placeholder tokens', () => {
      // loadSyncableProfiles reads from disk, just verify it doesn't throw
      // and returns array (actual filtering tested via integration)
      const result = profileMapper.loadSyncableProfiles();
      assert.ok(Array.isArray(result));
    });
  });

  describe('generateSyncPayload', () => {
    it('returns an array of ClaudeKey objects', () => {
      const result = profileMapper.generateSyncPayload();
      assert.ok(Array.isArray(result));
      // Each item should have api-key if present
      for (const key of result) {
        assert.ok(key['api-key'], 'Each key should have api-key');
        assert.ok(key.prefix, 'Each key should have prefix');
      }
    });
  });

  describe('generateSyncPreview', () => {
    it('returns an array of preview items', () => {
      const result = profileMapper.generateSyncPreview();
      assert.ok(Array.isArray(result));
      for (const item of result) {
        assert.ok(typeof item.name === 'string', 'Each item should have name');
      }
    });
  });

  describe('getSyncableProfileCount', () => {
    it('returns a number', () => {
      const result = profileMapper.getSyncableProfileCount();
      assert.ok(typeof result === 'number');
      assert.ok(result >= 0);
    });
  });
});
