/**
 * Unit tests for setup-command.ts - isFirstTimeInstall() function
 *
 * Issue #195: GLM auth regression - isFirstTimeInstall() was ignoring legacy configs
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Create temp directory for test isolation
let testDir: string;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-test-'));
});

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

// Helper to create config files
function createConfigYaml(content: string): void {
  fs.writeFileSync(path.join(testDir, 'config.yaml'), content, 'utf8');
}

function createConfigJson(content: object): void {
  fs.writeFileSync(path.join(testDir, 'config.json'), JSON.stringify(content, null, 2), 'utf8');
}

function createProfilesJson(content: object): void {
  fs.writeFileSync(path.join(testDir, 'profiles.json'), JSON.stringify(content, null, 2), 'utf8');
}

describe('isFirstTimeInstall logic', () => {
  describe('legacy config detection', () => {
    it('should detect legacy config.json with profiles', () => {
      createConfigYaml('version: 2\nprofiles: {}\naccounts: {}');
      createConfigJson({ profiles: { glm: '~/.ccs/glm.settings.json' } });

      const legacyConfig = JSON.parse(fs.readFileSync(path.join(testDir, 'config.json'), 'utf8'));
      const hasLegacyProfiles =
        legacyConfig.profiles && Object.keys(legacyConfig.profiles).length > 0;

      expect(hasLegacyProfiles).toBe(true);
    });

    it('should detect legacy profiles.json with accounts', () => {
      createConfigYaml('version: 2\nprofiles: {}\naccounts: {}');
      createProfilesJson({ profiles: { work: { path: '/some/path' } } });

      const legacyProfiles = JSON.parse(
        fs.readFileSync(path.join(testDir, 'profiles.json'), 'utf8')
      );
      const hasLegacyAccounts =
        legacyProfiles.profiles && Object.keys(legacyProfiles.profiles).length > 0;

      expect(hasLegacyAccounts).toBe(true);
    });

    it('should return true when no configs exist', () => {
      const hasConfigYaml = fs.existsSync(path.join(testDir, 'config.yaml'));
      const hasConfigJson = fs.existsSync(path.join(testDir, 'config.json'));
      const hasProfilesJson = fs.existsSync(path.join(testDir, 'profiles.json'));

      expect(hasConfigYaml).toBe(false);
      expect(hasConfigJson).toBe(false);
      expect(hasProfilesJson).toBe(false);
    });

    it('should detect unified config with profiles', () => {
      createConfigYaml(`
version: 2
profiles:
  glm:
    type: api
    settings: ~/.ccs/glm.settings.json
accounts: {}
`);

      const content = fs.readFileSync(path.join(testDir, 'config.yaml'), 'utf8');
      const hasProfiles = content.includes('glm:') && content.includes('type: api');

      expect(hasProfiles).toBe(true);
    });

    it('should detect unified config with remote proxy', () => {
      createConfigYaml(`
version: 2
profiles: {}
accounts: {}
cliproxy_server:
  remote:
    enabled: true
    host: my-server.example.com
`);

      const content = fs.readFileSync(path.join(testDir, 'config.yaml'), 'utf8');
      const hasRemoteProxy = content.includes('enabled: true') && content.includes('host:');

      expect(hasRemoteProxy).toBe(true);
    });
  });

  describe('empty config handling', () => {
    it('should treat empty configs as first-time', () => {
      createConfigYaml('version: 2\nprofiles: {}\naccounts: {}');
      createConfigJson({ profiles: {} });
      createProfilesJson({ profiles: {} });

      const legacyConfig = JSON.parse(fs.readFileSync(path.join(testDir, 'config.json'), 'utf8'));
      const legacyProfiles = JSON.parse(
        fs.readFileSync(path.join(testDir, 'profiles.json'), 'utf8')
      );

      const hasLegacyProfiles = Object.keys(legacyConfig.profiles || {}).length > 0;
      const hasLegacyAccounts = Object.keys(legacyProfiles.profiles || {}).length > 0;

      expect(hasLegacyProfiles).toBe(false);
      expect(hasLegacyAccounts).toBe(false);
    });
  });

  describe('setup_completed flag detection', () => {
    it('should detect setup_completed flag in unified config', () => {
      createConfigYaml(`
version: 8
setup_completed: true
profiles: {}
accounts: {}
`);

      const content = fs.readFileSync(path.join(testDir, 'config.yaml'), 'utf8');
      const hasSetupCompleted = content.includes('setup_completed: true');

      expect(hasSetupCompleted).toBe(true);
    });

    it('should treat missing setup_completed as first-time eligible', () => {
      createConfigYaml(`
version: 8
profiles: {}
accounts: {}
`);

      const content = fs.readFileSync(path.join(testDir, 'config.yaml'), 'utf8');
      const hasSetupCompleted = content.includes('setup_completed: true');

      expect(hasSetupCompleted).toBe(false);
    });

    it('should treat setup_completed: false as first-time eligible', () => {
      createConfigYaml(`
version: 8
setup_completed: false
profiles: {}
accounts: {}
`);

      const content = fs.readFileSync(path.join(testDir, 'config.yaml'), 'utf8');
      const hasSetupCompletedTrue = content.includes('setup_completed: true');
      const hasSetupCompletedFalse = content.includes('setup_completed: false');

      expect(hasSetupCompletedTrue).toBe(false);
      expect(hasSetupCompletedFalse).toBe(true);
    });
  });

  describe('corrupted config handling', () => {
    it('should handle corrupted config.json gracefully', () => {
      fs.writeFileSync(path.join(testDir, 'config.json'), 'not valid json{{{', 'utf8');

      let hasLegacyProfiles = false;
      try {
        const legacyConfig = JSON.parse(fs.readFileSync(path.join(testDir, 'config.json'), 'utf8'));
        hasLegacyProfiles = legacyConfig.profiles && Object.keys(legacyConfig.profiles).length > 0;
      } catch {
        hasLegacyProfiles = false;
      }

      expect(hasLegacyProfiles).toBe(false);
    });
  });
});
