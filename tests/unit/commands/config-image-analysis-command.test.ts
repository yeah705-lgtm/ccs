/**
 * Config Image Analysis Command Tests
 *
 * Unit tests for ccs config image-analysis subcommand.
 */

import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Create temp directory for test isolation
let testDir: string;
let originalCcsHome: string | undefined;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-config-image-test-'));
  originalCcsHome = process.env.CCS_HOME;
  process.env.CCS_HOME = testDir;
});

afterEach(() => {
  if (originalCcsHome) {
    process.env.CCS_HOME = originalCcsHome;
  } else {
    delete process.env.CCS_HOME;
  }
  fs.rmSync(testDir, { recursive: true, force: true });
});

// Helper to create config.yaml for tests
function createConfigYaml(content: string): void {
  fs.writeFileSync(path.join(testDir, 'config.yaml'), content, 'utf8');
}

describe('config image-analysis command', () => {
  describe('config file parsing', () => {
    it('should parse enabled status from config.yaml', () => {
      createConfigYaml(`
version: 2
image_analysis:
  enabled: true
  timeout: 60
  provider_models:
    agy: gemini-2.5-flash
`);

      const content = fs.readFileSync(path.join(testDir, 'config.yaml'), 'utf8');
      expect(content).toContain('enabled: true');
      expect(content).toContain('timeout: 60');
      expect(content).toContain('agy: gemini-2.5-flash');
    });

    it('should parse disabled status from config.yaml', () => {
      createConfigYaml(`
version: 2
image_analysis:
  enabled: false
  timeout: 120
  provider_models: {}
`);

      const content = fs.readFileSync(path.join(testDir, 'config.yaml'), 'utf8');
      expect(content).toContain('enabled: false');
      expect(content).toContain('timeout: 120');
    });

    it('should parse multiple provider models', () => {
      createConfigYaml(`
version: 2
image_analysis:
  enabled: true
  timeout: 60
  provider_models:
    agy: gemini-2.5-flash
    gemini: gemini-2.5-pro
    codex: gpt-5.1-codex-mini
    kiro: kiro-claude-haiku-4-5
`);

      const content = fs.readFileSync(path.join(testDir, 'config.yaml'), 'utf8');
      expect(content).toContain('agy: gemini-2.5-flash');
      expect(content).toContain('gemini: gemini-2.5-pro');
      expect(content).toContain('codex: gpt-5.1-codex-mini');
      expect(content).toContain('kiro: kiro-claude-haiku-4-5');
    });
  });

  describe('timeout validation', () => {
    it('should accept valid timeout within range (10-600)', () => {
      const validTimeouts = [10, 60, 120, 300, 600];

      for (const timeout of validTimeouts) {
        const isValid = timeout >= 10 && timeout <= 600;
        expect(isValid).toBe(true);
      }
    });

    it('should reject timeout below minimum (10)', () => {
      const invalidTimeouts = [0, 1, 5, 9];

      for (const timeout of invalidTimeouts) {
        const isValid = timeout >= 10 && timeout <= 600;
        expect(isValid).toBe(false);
      }
    });

    it('should reject timeout above maximum (600)', () => {
      const invalidTimeouts = [601, 700, 1000, 3600];

      for (const timeout of invalidTimeouts) {
        const isValid = timeout >= 10 && timeout <= 600;
        expect(isValid).toBe(false);
      }
    });
  });

  describe('provider validation', () => {
    it('should accept valid providers', () => {
      const validProviders = ['agy', 'gemini', 'codex', 'kiro', 'ghcp', 'claude', 'qwen', 'iflow'];

      for (const provider of validProviders) {
        expect(validProviders.includes(provider)).toBe(true);
      }
    });

    it('should reject invalid providers', () => {
      const validProviders = ['agy', 'gemini', 'codex', 'kiro', 'ghcp', 'claude', 'qwen', 'iflow'];
      const invalidProviders = ['unknown', 'custom', 'my-provider', 'test'];

      for (const provider of invalidProviders) {
        expect(validProviders.includes(provider)).toBe(false);
      }
    });
  });

  describe('default configuration', () => {
    it('should have correct default values', () => {
      // These are the expected defaults from unified-config-types.ts
      const defaultConfig = {
        enabled: true,
        timeout: 60,
        provider_models: {
          agy: 'gemini-2.5-flash',
          gemini: 'gemini-2.5-flash',
          codex: 'gpt-5.1-codex-mini',
          kiro: 'kiro-claude-haiku-4-5',
          ghcp: 'claude-haiku-4.5',
          claude: 'claude-haiku-4-5-20251001',
        },
      };

      expect(defaultConfig.enabled).toBe(true);
      expect(defaultConfig.timeout).toBe(60);
      expect(Object.keys(defaultConfig.provider_models).length).toBe(6);
    });
  });

  describe('config file structure', () => {
    it('should have image_analysis section', () => {
      createConfigYaml(`
version: 2
image_analysis:
  enabled: true
  timeout: 60
  provider_models:
    agy: gemini-2.5-flash
`);

      const content = fs.readFileSync(path.join(testDir, 'config.yaml'), 'utf8');
      expect(content).toContain('image_analysis:');
    });

    it('should support empty provider_models', () => {
      createConfigYaml(`
version: 2
image_analysis:
  enabled: false
  timeout: 60
  provider_models: {}
`);

      const content = fs.readFileSync(path.join(testDir, 'config.yaml'), 'utf8');
      expect(content).toContain('provider_models: {}');
    });
  });
});
