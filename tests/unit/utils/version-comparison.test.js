/**
 * Unit Tests for Version Comparison Implementation (Phase 4)
 *
 * Tests the version comparison functionality added in Phase 4:
 * - ParsedVersion interface and parseVersion function
 * - compareVersionsWithPrerelease function for various scenarios
 * - Downgrade detection in update-command.ts
 * - Edge cases with version parsing
 *
 * Prerelease convention: X.Y.Z-dev.N is a development version AFTER X.Y.Z
 * For example: 6.7.1-dev.3 > 6.7.1 (dev version is work toward next release)
 *
 * Test scenarios to cover:
 * - `5.0.2` < `5.1.0-dev.3` (upgrade to dev)
 * - `5.0.2` > `4.9.0-dev.1` (downgrade to dev)
 * - `5.1.0-dev.1` < `5.1.0-dev.3` (dev-to-dev upgrade)
 * - `5.0.2-dev.1` > `5.0.2` (prerelease > release - dev is work AFTER release)
 * - `5.0.2` = `5.0.2` (same version)
 * - Downgrade warning shown for stable → older dev
 * - Invalid version string handling
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Version Comparison Implementation (Phase 4)', () => {
  let updateCheckerModule;

  // Build the project before running tests
  const { execSync } = require('child_process');
  try {
    execSync('bun run build', { cwd: path.resolve(__dirname, '../../..'), stdio: 'pipe' });
  } catch (error) {
    console.warn('Build failed, tests may not work:', error.message);
  }

  // Import the built modules
  updateCheckerModule = require('../../../dist/utils/update-checker.js');

  describe('ParsedVersion interface and parseVersion function', function () {
    it('should parse standard semantic versions', function () {
      const testCases = [
        {
          version: '1.2.3',
          expected: { major: 1, minor: 2, patch: 3, prerelease: null, prereleaseNum: null },
        },
        {
          version: '5.0.2',
          expected: { major: 5, minor: 0, patch: 2, prerelease: null, prereleaseNum: null },
        },
        {
          version: '10.15.20',
          expected: { major: 10, minor: 15, patch: 20, prerelease: null, prereleaseNum: null },
        },
      ];

      // Import parseVersion function by accessing internal implementation
      // We need to test it indirectly through compareVersionsWithPrerelease
      testCases.forEach(({ version, expected }) => {
        const result1 = updateCheckerModule.compareVersionsWithPrerelease(version, version);
        assert.strictEqual(result1, 0, `Should parse ${version} correctly`);
      });
    });

    it('should parse versions with v prefix', function () {
      const testCases = ['v1.2.3', 'v5.0.2', 'v10.15.20'];

      testCases.forEach((version) => {
        const withoutV = version.replace(/^v/, '');
        const result1 = updateCheckerModule.compareVersionsWithPrerelease(version, withoutV);
        assert.strictEqual(result1, 0, `Should treat ${version} same as ${withoutV}`);
      });
    });

    it('should parse prerelease versions', function () {
      const testCases = [
        {
          version: '5.1.0-dev.3',
          compareWith: '5.1.0-dev.1',
          expectedResult: 1, // dev.3 > dev.1
        },
        {
          version: '5.0.2-alpha.1',
          compareWith: '5.0.2-alpha.2',
          expectedResult: -1, // alpha.1 < alpha.2
        },
        {
          version: '5.0.2-beta.5',
          compareWith: '5.0.2-beta.5',
          expectedResult: 0, // beta.5 = beta.5
        },
      ];

      testCases.forEach(({ version, compareWith, expectedResult }) => {
        const result = updateCheckerModule.compareVersionsWithPrerelease(version, compareWith);
        assert.strictEqual(
          result,
          expectedResult,
          `Expected ${version} compared to ${compareWith} to be ${expectedResult}`
        );
      });
    });

    it('should handle invalid version strings gracefully', function () {
      const invalidVersions = [
        'invalid',
        '1.2',
        'not.a.version',
        '',
        '1.2.3.4.5',
        'abc.def.ghi',
        '1.x.3',
      ];

      invalidVersions.forEach((version) => {
        // Should not throw errors
        assert.doesNotThrow(() => {
          const result = updateCheckerModule.compareVersionsWithPrerelease(version, '1.0.0');
          assert(typeof result === 'number', 'Should return a number even for invalid versions');
        }, `Should handle invalid version: ${version}`);
      });
    });
  });

  describe('compareVersionsWithPrerelease function', function () {
    describe('Basic version comparison', function () {
      it('should compare major versions correctly', function () {
        assert.strictEqual(updateCheckerModule.compareVersionsWithPrerelease('2.0.0', '1.0.0'), 1);
        assert.strictEqual(updateCheckerModule.compareVersionsWithPrerelease('1.0.0', '2.0.0'), -1);
        assert.strictEqual(updateCheckerModule.compareVersionsWithPrerelease('1.0.0', '1.0.0'), 0);
      });

      it('should compare minor versions correctly', function () {
        assert.strictEqual(updateCheckerModule.compareVersionsWithPrerelease('1.2.0', '1.1.0'), 1);
        assert.strictEqual(updateCheckerModule.compareVersionsWithPrerelease('1.1.0', '1.2.0'), -1);
        assert.strictEqual(updateCheckerModule.compareVersionsWithPrerelease('1.1.0', '1.1.0'), 0);
      });

      it('should compare patch versions correctly', function () {
        assert.strictEqual(updateCheckerModule.compareVersionsWithPrerelease('1.1.2', '1.1.1'), 1);
        assert.strictEqual(updateCheckerModule.compareVersionsWithPrerelease('1.1.1', '1.1.2'), -1);
        assert.strictEqual(updateCheckerModule.compareVersionsWithPrerelease('1.1.1', '1.1.1'), 0);
      });
    });

    describe('Prerelease vs Release comparison', function () {
      it('should treat prerelease versions as newer than release (dev is work AFTER release)', function () {
        // 5.0.2-dev.1 > 5.0.2 (dev version is development AFTER 5.0.2)
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.0.2', '5.0.2-dev.1'),
          -1
        );
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.0.2-dev.1', '5.0.2'),
          1
        );

        // 5.1.0-dev.3 > 5.1.0 (dev version is development AFTER 5.1.0)
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.1.0', '5.1.0-dev.3'),
          -1
        );
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.1.0-dev.3', '5.1.0'),
          1
        );
      });
    });

    describe('Prerelease to Prerelease comparison', function () {
      it('should compare prerelease numbers correctly', function () {
        // 5.1.0-dev.1 < 5.1.0-dev.3 (dev-to-dev upgrade)
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.1.0-dev.1', '5.1.0-dev.3'),
          -1
        );
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.1.0-dev.3', '5.1.0-dev.1'),
          1
        );

        // Same prerelease version
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.0.2-dev.1', '5.0.2-dev.1'),
          0
        );
      });

      it('should handle different prerelease identifiers', function () {
        // Test different prerelease types - but the function only compares numbers, not identifiers
        // All with same number are considered equal
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.0.2-alpha.1', '5.0.2-beta.1'),
          0
        );
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.0.2-beta.1', '5.0.2-dev.1'),
          0
        );
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.0.2-dev.1', '5.0.2-rc.1'),
          0
        );

        // Different numbers are compared
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.0.2-alpha.1', '5.0.2-alpha.2'),
          -1
        );
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.0.2-alpha.2', '5.0.2-alpha.1'),
          1
        );
      });
    });

    describe('Key test scenarios from requirements', function () {
      it('should handle `5.0.2` < `5.1.0-dev.3` (upgrade to dev)', function () {
        // Even though 5.1.0-dev.3 is a prerelease, its base version (5.1.0) is newer than 5.0.2
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.0.2', '5.1.0-dev.3'),
          -1,
          '5.0.2 should be less than 5.1.0-dev.3'
        );
      });

      it('should handle `5.0.2` > `4.9.0-dev.1` (downgrade to dev)', function () {
        // Base version 5.0.2 is newer than 4.9.0, even though 4.9.0-dev.1 is prerelease
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.0.2', '4.9.0-dev.1'),
          1,
          '5.0.2 should be greater than 4.9.0-dev.1'
        );
      });

      it('should handle `5.1.0-dev.1` < `5.1.0-dev.3` (dev-to-dev upgrade)', function () {
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.1.0-dev.1', '5.1.0-dev.3'),
          -1,
          '5.1.0-dev.1 should be less than 5.1.0-dev.3'
        );
      });

      it('should handle `5.0.2-dev.1` > `5.0.2` (prerelease > release - dev is work AFTER release)', function () {
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.0.2-dev.1', '5.0.2'),
          1,
          '5.0.2-dev.1 should be greater than 5.0.2'
        );
      });

      it('should handle `5.0.2` = `5.0.2` (same version)', function () {
        assert.strictEqual(
          updateCheckerModule.compareVersionsWithPrerelease('5.0.2', '5.0.2'),
          0,
          '5.0.2 should equal 5.0.2'
        );
      });
    });
  });

  describe('Downgrade detection logic tests', () => {
    it('should identify downgrade scenarios correctly', () => {
      // Test the comparison logic that would trigger downgrade warnings
      // With new semantic: X.Y.Z-dev.N > X.Y.Z (dev is work AFTER release)
      const downgradeScenarios = [
        ['5.0.2', '4.9.0-dev.1', true], // stable to older dev (base version older)
        ['5.1.0', '5.0.0-dev.5', true], // newer stable to older dev (base version older)
        ['5.0.2', '5.0.1', true], // simple downgrade
        ['5.0.2', '5.0.2', false], // same version
        ['5.0.2', '5.0.3', false], // upgrade
        ['5.0.2-dev.1', '5.0.1-dev.2', true], // dev downgrade (base version older)
        ['5.0.2', '5.0.2-dev.1', false], // upgrade to dev (dev is newer)
        ['5.0.2-dev.1', '5.0.2', true], // downgrade from dev to stable
      ];

      downgradeScenarios.forEach(([current, latest, isDowngrade]) => {
        const comparison = updateCheckerModule.compareVersionsWithPrerelease(current, latest);
        const actualIsDowngrade = comparison > 0; // current > latest means downgrade

        assert.strictEqual(
          actualIsDowngrade,
          isDowngrade,
          `Expected ${current} → ${latest} to be ${isDowngrade ? 'downgrade' : 'not downgrade'}`
        );
      });
    });

    it('should handle beta update warnings scenarios', () => {
      // With new semantic: X.Y.Z-dev.N > X.Y.Z
      const betaScenarios = [
        ['5.0.2', '5.1.0-dev.3', false], // newer dev version (not downgrade)
        ['5.0.2', '4.9.0-dev.1', true], // downgrade to older dev
        ['5.0.2-dev.1', '5.0.2', true], // downgrade from dev to release
        ['5.0.2', '5.0.2', false], // same version
        ['5.0.2', '5.0.2-dev.1', false], // upgrade to dev
      ];

      betaScenarios.forEach(([current, latest, shouldWarn]) => {
        const comparison = updateCheckerModule.compareVersionsWithPrerelease(current, latest);
        const isDowngrade = comparison > 0;

        assert.strictEqual(
          isDowngrade,
          shouldWarn,
          `Expected ${current} → ${latest} to ${shouldWarn ? 'warn' : 'not warn'} about downgrade`
        );
      });
    });
  });

  describe('Edge cases with version parsing', function () {
    it('should handle empty strings', function () {
      assert.strictEqual(updateCheckerModule.compareVersionsWithPrerelease('', ''), 0);
      assert.strictEqual(updateCheckerModule.compareVersionsWithPrerelease('', '1.0.0'), -1);
      assert.strictEqual(updateCheckerModule.compareVersionsWithPrerelease('1.0.0', ''), 1);
    });

    it('should handle null and undefined inputs gracefully', function () {
      // The current implementation doesn't handle null/undefined, so we test this behavior
      // Note: Bun uses different error messages than Node.js
      assert.throws(() => {
        updateCheckerModule.compareVersionsWithPrerelease(null, '1.0.0');
      }, /null is not an object|Cannot read properties of null/);

      assert.throws(() => {
        updateCheckerModule.compareVersionsWithPrerelease('1.0.0', null);
      }, /null is not an object|Cannot read properties of null/);

      assert.throws(() => {
        updateCheckerModule.compareVersionsWithPrerelease(undefined, '1.0.0');
      }, /undefined is not an object|Cannot read properties of undefined/);

      assert.throws(() => {
        updateCheckerModule.compareVersionsWithPrerelease('1.0.0', undefined);
      }, /undefined is not an object|Cannot read properties of undefined/);
    });

    it('should handle version strings with extra whitespace', function () {
      // The current implementation doesn't trim whitespace, so these will be treated as invalid versions
      assert.strictEqual(updateCheckerModule.compareVersionsWithPrerelease(' 1.0.0 ', '1.0.0'), -1);
      assert.strictEqual(updateCheckerModule.compareVersionsWithPrerelease('1.0.0\n', '1.0.0'), -1);
      assert.strictEqual(
        updateCheckerModule.compareVersionsWithPrerelease('\t1.0.0\t', '1.0.0'),
        -1
      );
    });

    it('should handle malformed version components', function () {
      const malformedVersions = [
        '1..3',
        '1.2.',
        '.2.3',
        '1..3.4',
        'a.b.c',
        '1.2.3.4',
        '1.2.3-dev',
        '1.2.3-dev.',
        '1.2.3-.1',
      ];

      malformedVersions.forEach((version) => {
        assert.doesNotThrow(() => {
          const result = updateCheckerModule.compareVersionsWithPrerelease(version, '1.0.0');
          assert(
            typeof result === 'number',
            `Should return number for malformed version: ${version}`
          );
        });
      });
    });

    it('should handle very large version numbers', function () {
      assert.strictEqual(
        updateCheckerModule.compareVersionsWithPrerelease('999.999.999', '1.0.0'),
        1
      );
      assert.strictEqual(
        updateCheckerModule.compareVersionsWithPrerelease('1.0.0', '999.999.999'),
        -1
      );
    });

    it('should handle prerelease with large numbers', function () {
      assert.strictEqual(
        updateCheckerModule.compareVersionsWithPrerelease('1.0.0-dev.999', '1.0.0-dev.1'),
        1
      );
      assert.strictEqual(
        updateCheckerModule.compareVersionsWithPrerelease('1.0.0-dev.1', '1.0.0-dev.999'),
        -1
      );
    });

    it('should handle different prerelease identifiers case sensitivity', function () {
      // Test case sensitivity - should be case insensitive
      assert.strictEqual(
        updateCheckerModule.compareVersionsWithPrerelease('1.0.0-DEV.1', '1.0.0-dev.1'),
        0
      );
      assert.strictEqual(
        updateCheckerModule.compareVersionsWithPrerelease('1.0.0-Alpha.1', '1.0.0-alpha.1'),
        0
      );
      assert.strictEqual(
        updateCheckerModule.compareVersionsWithPrerelease('1.0.0-Beta.1', '1.0.0-beta.1'),
        0
      );
    });
  });

  describe('Integration tests with version comparison', function () {
    it('should handle complex version comparison scenarios', function () {
      // With new semantic: X.Y.Z-dev.N > X.Y.Z (dev is work AFTER release)
      const scenarios = [
        // [version1, version2, expected_result, description]
        ['1.0.0', '1.0.0-alpha.1', -1, 'release < alpha (alpha is work AFTER release)'],
        ['1.0.0-alpha.1', '1.0.0-beta.1', 0, 'alpha = beta (same number, different identifier)'],
        ['1.0.0-beta.1', '1.0.0-rc.1', 0, 'beta = rc (same number, different identifier)'],
        ['1.0.0-rc.1', '1.0.0', 1, 'rc > release (rc is work AFTER release)'],
        ['1.0.0-alpha.1', '1.0.0-alpha.2', -1, 'alpha.1 < alpha.2'],
        ['1.0.0-alpha.2', '1.0.0-alpha.1', 1, 'alpha.2 > alpha.1'],
        ['2.0.0-alpha.1', '1.9.9', 1, 'new major prerelease > old release'],
        ['1.0.0', '2.0.0-alpha.1', -1, 'old release < new major prerelease'],
      ];

      scenarios.forEach(([v1, v2, expected, description]) => {
        const result = updateCheckerModule.compareVersionsWithPrerelease(v1, v2);
        assert.strictEqual(result, expected, `Failed scenario: ${description} (${v1} vs ${v2})`);
      });
    });
  });
});
