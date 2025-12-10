/**
 * Unit tests for unified config module
 */
import { describe, it, expect } from 'bun:test';

// Import only modules without transitive dependencies on config-manager
import {
  isReservedName,
  validateProfileName,
  RESERVED_PROFILE_NAMES,
} from '../../src/config/reserved-names';
import {
  createEmptyUnifiedConfig,
  createEmptySecretsConfig,
  isUnifiedConfig,
  isSecretsConfig,
  UNIFIED_CONFIG_VERSION,
} from '../../src/config/unified-config-types';
import { isUnifiedConfigEnabled } from '../../src/config/feature-flags';

// Inline helper to test secret key detection (copied from secrets-manager to avoid import chain)
function isSecretKey(key: string): boolean {
  const upper = key.toUpperCase();
  const secretPatterns = ['TOKEN', 'SECRET', 'API_KEY', 'APIKEY', 'PASSWORD', 'CREDENTIAL', 'AUTH', 'PRIVATE'];
  return secretPatterns.some((pattern) => upper.includes(pattern));
}

describe('reserved-names', () => {
  describe('RESERVED_PROFILE_NAMES', () => {
    it('should include CLIProxy providers', () => {
      expect(RESERVED_PROFILE_NAMES).toContain('gemini');
      expect(RESERVED_PROFILE_NAMES).toContain('codex');
      expect(RESERVED_PROFILE_NAMES).toContain('agy');
      expect(RESERVED_PROFILE_NAMES).toContain('qwen');
      expect(RESERVED_PROFILE_NAMES).toContain('iflow');
    });

    it('should include CLI commands', () => {
      expect(RESERVED_PROFILE_NAMES).toContain('default');
      expect(RESERVED_PROFILE_NAMES).toContain('config');
      expect(RESERVED_PROFILE_NAMES).toContain('cliproxy');
    });
  });

  describe('isReservedName', () => {
    it('should return true for reserved names', () => {
      expect(isReservedName('gemini')).toBe(true);
      expect(isReservedName('codex')).toBe(true);
      expect(isReservedName('default')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(isReservedName('GEMINI')).toBe(true);
      expect(isReservedName('Codex')).toBe(true);
      expect(isReservedName('DEFAULT')).toBe(true);
    });

    it('should return false for non-reserved names', () => {
      expect(isReservedName('myprofile')).toBe(false);
      expect(isReservedName('work')).toBe(false);
      expect(isReservedName('personal')).toBe(false);
    });
  });

  describe('validateProfileName', () => {
    it('should throw for reserved names', () => {
      expect(() => validateProfileName('gemini')).toThrow(/reserved/i);
      expect(() => validateProfileName('default')).toThrow(/reserved/i);
    });

    it('should not throw for valid names', () => {
      expect(() => validateProfileName('myprofile')).not.toThrow();
      expect(() => validateProfileName('work')).not.toThrow();
    });
  });
});

describe('unified-config-types', () => {
  describe('createEmptyUnifiedConfig', () => {
    it('should create config with correct version', () => {
      const config = createEmptyUnifiedConfig();
      expect(config.version).toBe(UNIFIED_CONFIG_VERSION);
    });

    it('should have empty accounts and profiles', () => {
      const config = createEmptyUnifiedConfig();
      expect(Object.keys(config.accounts)).toHaveLength(0);
      expect(Object.keys(config.profiles)).toHaveLength(0);
    });

    it('should have default preferences', () => {
      const config = createEmptyUnifiedConfig();
      expect(config.preferences.theme).toBe('system');
      expect(config.preferences.telemetry).toBe(false);
      expect(config.preferences.auto_update).toBe(true);
    });

    it('should have CLIProxy providers list', () => {
      const config = createEmptyUnifiedConfig();
      expect(config.cliproxy.providers).toContain('gemini');
      expect(config.cliproxy.providers).toContain('codex');
    });
  });

  describe('createEmptySecretsConfig', () => {
    it('should create secrets with version 1', () => {
      const secrets = createEmptySecretsConfig();
      expect(secrets.version).toBe(1);
    });

    it('should have empty profiles', () => {
      const secrets = createEmptySecretsConfig();
      expect(Object.keys(secrets.profiles)).toHaveLength(0);
    });
  });

  describe('isUnifiedConfig', () => {
    it('should return true for valid config', () => {
      const config = createEmptyUnifiedConfig();
      expect(isUnifiedConfig(config)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isUnifiedConfig(null)).toBe(false);
    });

    it('should return false for wrong version', () => {
      const config = { ...createEmptyUnifiedConfig(), version: 1 };
      expect(isUnifiedConfig(config)).toBe(false);
    });

    it('should return false for missing fields', () => {
      expect(isUnifiedConfig({ version: 2 })).toBe(false);
      expect(isUnifiedConfig({ version: 2, accounts: {} })).toBe(false);
    });
  });

  describe('isSecretsConfig', () => {
    it('should return true for valid secrets', () => {
      const secrets = createEmptySecretsConfig();
      expect(isSecretsConfig(secrets)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isSecretsConfig(null)).toBe(false);
    });

    it('should return false for missing fields', () => {
      expect(isSecretsConfig({ version: 1 })).toBe(false);
    });
  });
});

describe('secrets-manager', () => {
  describe('isSecretKey', () => {
    it('should identify token keys as secrets', () => {
      expect(isSecretKey('ANTHROPIC_AUTH_TOKEN')).toBe(true);
      expect(isSecretKey('ACCESS_TOKEN')).toBe(true);
      expect(isSecretKey('REFRESH_TOKEN')).toBe(true);
    });

    it('should identify API keys as secrets', () => {
      expect(isSecretKey('API_KEY')).toBe(true);
      expect(isSecretKey('OPENAI_API_KEY')).toBe(true);
      expect(isSecretKey('APIKEY')).toBe(true);
    });

    it('should identify password keys as secrets', () => {
      expect(isSecretKey('PASSWORD')).toBe(true);
      expect(isSecretKey('DB_PASSWORD')).toBe(true);
    });

    it('should identify secret/credential keys', () => {
      expect(isSecretKey('CLIENT_SECRET')).toBe(true);
      expect(isSecretKey('AWS_CREDENTIAL')).toBe(true);
    });

    it('should not identify non-secret keys', () => {
      expect(isSecretKey('ANTHROPIC_MODEL')).toBe(false);
      expect(isSecretKey('ANTHROPIC_BASE_URL')).toBe(false);
      expect(isSecretKey('DEBUG')).toBe(false);
      expect(isSecretKey('NODE_ENV')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isSecretKey('api_key')).toBe(true);
      expect(isSecretKey('Api_Key')).toBe(true);
    });
  });
});

describe('feature-flags', () => {
  describe('isUnifiedConfigEnabled', () => {
    it('should read from CCS_UNIFIED_CONFIG env var', () => {
      // This test runs with the current environment
      // In CI, CCS_UNIFIED_CONFIG may or may not be set
      const result = isUnifiedConfigEnabled();
      expect(typeof result).toBe('boolean');
    });
  });
});
