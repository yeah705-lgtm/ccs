const assert = require('assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('npm postinstall', () => {
  const ccsDir = path.join(os.homedir(), '.ccs');
  const configPath = path.join(ccsDir, 'config.json');
  const glmPath = path.join(ccsDir, 'glm.settings.json');
  const postinstallScript = path.join(__dirname, '..', '..', 'scripts', 'postinstall.js');

  beforeEach(() => {
    // Clean slate before each test
    if (fs.existsSync(ccsDir)) {
      fs.rmSync(ccsDir, { recursive: true, force: true });
    }
  });

  after(() => {
    // Cleanup after all tests
    if (fs.existsSync(ccsDir)) {
      fs.rmSync(ccsDir, { recursive: true, force: true });
    }
  });

  it('creates config.json', () => {
    execSync(`node "${postinstallScript}"`, { stdio: 'ignore' });

    assert(fs.existsSync(configPath), 'config.json should be created');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert(config.profiles, 'config.json should have profiles');
    assert(typeof config.profiles === 'object', 'profiles should be an object');
  });

  it('creates glm.settings.json', () => {
    execSync(`node "${postinstallScript}"`, { stdio: 'ignore' });

    assert(fs.existsSync(glmPath), 'glm.settings.json should be created');

    const glmSettings = JSON.parse(fs.readFileSync(glmPath, 'utf8'));
    assert(glmSettings.env, 'glm.settings.json should have env section');
    assert(glmSettings.env.ANTHROPIC_MODEL, 'should have ANTHROPIC_MODEL set');
    assert.strictEqual(glmSettings.env.ANTHROPIC_MODEL, 'glm-4.6');
  });

  it('is idempotent', () => {
    // Run postinstall first time
    execSync(`node "${postinstallScript}"`, { stdio: 'ignore' });

    // Create custom config
    const customConfig = {
      profiles: {
        custom: '~/.custom.json',
        glm: '~/.ccs/glm.settings.json'
      }
    };
    fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2));

    // Run postinstall again
    execSync(`node "${postinstallScript}"`, { stdio: 'ignore' });

    // Verify custom config preserved
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert(config.profiles.custom, 'Custom profile should be preserved');
    assert.strictEqual(config.profiles.custom, '~/.custom.json');
  });

  it('uses ASCII symbols', () => {
    const output = execSync(`node "${postinstallScript}"`, { encoding: 'utf8' });

    // Check for ASCII symbols [OK], [!], [X], [i] - not emojis
    assert(/\[(OK|!|X|i)\]/.test(output), 'Should use ASCII symbols, not emojis');

    // Verify no emojis in output
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    assert(!emojiRegex.test(output), 'Should not contain emojis');
  });

  it('handles existing directory gracefully', () => {
    // Create directory manually first
    fs.mkdirSync(ccsDir, { recursive: true });
    fs.writeFileSync(path.join(ccsDir, 'existing.txt'), 'exists');

    // Run postinstall
    execSync(`node "${postinstallScript}"`, { stdio: 'ignore' });

    // Verify existing file still exists and new files are created
    assert(fs.existsSync(path.join(ccsDir, 'existing.txt')), 'Existing files should be preserved');
    assert(fs.existsSync(configPath), 'config.json should be created');
    assert(fs.existsSync(glmPath), 'glm.settings.json should be created');
  });

  it('creates VERSION file', () => {
    execSync(`node "${postinstallScript}"`, { stdio: 'ignore' });

    const versionPath = path.join(ccsDir, 'VERSION');
    assert(fs.existsSync(versionPath), 'VERSION file should be created');

    const version = fs.readFileSync(versionPath, 'utf8').trim();
    assert(/\d+\.\d+\.\d+/.test(version), 'VERSION should be in semantic version format');
  });
});