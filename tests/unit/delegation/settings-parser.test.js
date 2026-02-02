const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SettingsParser } = require('../../../dist/delegation/settings-parser');

describe('SettingsParser', () => {
  const testDir = path.join(os.tmpdir(), 'ccs-test-settings');
  const claudeDir = path.join(testDir, '.claude');

  function setupTestDir() {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  function cleanupTestDir() {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  }

  beforeEach(() => {
    setupTestDir();
  });

  afterAll(() => {
    cleanupTestDir();
  });

  describe('No settings files', () => {
    it('returns empty arrays when no settings files', () => {
      const restrictions = SettingsParser.parseToolRestrictions(testDir);

      assert.strictEqual(restrictions.allowedTools.length, 0);
      assert.strictEqual(restrictions.disallowedTools.length, 0);
    });
  });

  describe('Parse shared settings', () => {
    it('parses shared settings.json', () => {
      const settingsPath = path.join(claudeDir, 'settings.json');
      fs.writeFileSync(
        settingsPath,
        JSON.stringify({
          permissions: {
            allow: ['Bash(git:*)', 'Read'],
            deny: ['Bash(rm:*)'],
          },
        })
      );

      const restrictions = SettingsParser.parseToolRestrictions(testDir);

      assert.strictEqual(restrictions.allowedTools.length, 2);
      assert.strictEqual(restrictions.disallowedTools.length, 1);
      assert.ok(restrictions.allowedTools.includes('Bash(git:*)'));
      assert.ok(restrictions.disallowedTools.includes('Bash(rm:*)'));
    });
  });

  describe('Local settings override', () => {
    it('local settings override shared', () => {
      fs.writeFileSync(
        path.join(claudeDir, 'settings.json'),
        JSON.stringify({
          permissions: {
            allow: ['Read'],
            deny: [],
          },
        })
      );

      fs.writeFileSync(
        path.join(claudeDir, 'settings.local.json'),
        JSON.stringify({
          permissions: {
            allow: ['Bash(git:*)'],
            deny: ['Bash(rm:*)'],
          },
        })
      );

      const restrictions = SettingsParser.parseToolRestrictions(testDir);

      assert.strictEqual(restrictions.allowedTools.length, 2);
      assert.ok(restrictions.allowedTools.includes('Read'));
      assert.ok(restrictions.allowedTools.includes('Bash(git:*)'));
      assert.strictEqual(restrictions.disallowedTools.length, 1);
    });
  });

  describe('Error handling', () => {
    it('handles malformed JSON gracefully', () => {
      const settingsPath = path.join(claudeDir, 'settings.json');
      fs.writeFileSync(settingsPath, '{ invalid json }');

      const restrictions = SettingsParser.parseToolRestrictions(testDir);

      assert.strictEqual(restrictions.allowedTools.length, 0);
      assert.strictEqual(restrictions.disallowedTools.length, 0);
    });

    it('handles settings without permissions key', () => {
      const settingsPath = path.join(claudeDir, 'settings.json');
      fs.writeFileSync(
        settingsPath,
        JSON.stringify({
          someOtherKey: 'value',
        })
      );

      const restrictions = SettingsParser.parseToolRestrictions(testDir);

      assert.strictEqual(restrictions.allowedTools.length, 0);
      assert.strictEqual(restrictions.disallowedTools.length, 0);
    });

    it('handles empty permissions arrays', () => {
      const settingsPath = path.join(claudeDir, 'settings.json');
      fs.writeFileSync(
        settingsPath,
        JSON.stringify({
          permissions: {
            allow: [],
            deny: [],
          },
        })
      );

      const restrictions = SettingsParser.parseToolRestrictions(testDir);

      assert.strictEqual(restrictions.allowedTools.length, 0);
      assert.strictEqual(restrictions.disallowedTools.length, 0);
    });
  });
});
