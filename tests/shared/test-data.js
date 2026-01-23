/**
 * Shared test data for CCS npm tests
 * Common test profiles, configurations, and sample data
 */

module.exports = {
  // Valid profile names for testing
  validProfiles: ['glm', 'sonnet', 'default', 'haiku', 'opus'],

  // Invalid profile names for error testing
  invalidProfiles: [
    'test@profile',        // Contains @ symbol
    'profile;injection',   // Contains semicolon
    'profile|pipe',        // Contains pipe
    'profile>redirect',    // Contains redirect
    'profile$(command)',   // Contains command injection
    '',                    // Empty string
    ' ',                   // Space only
    'profile with spaces', // Contains spaces
    'profile-with-dashes!',// Contains exclamation
    'a'.repeat(100),       // Very long name
  ],

  // Sample configuration data
  sampleConfig: {
    profiles: {
      glm: '~/.ccs/glm.settings.json',
      sonnet: '~/.ccs/sonnet.settings.json',
      default: '~/.ccs/default.settings.json'
    }
  },

  // Sample GLM settings
  sampleGlmSettings: {
    env: {
      ANTHROPIC_BASE_URL: "https://api.z.ai/api/anthropic",
      ANTHROPIC_AUTH_TOKEN: "your_api_key_here",
      ANTHROPIC_MODEL: "glm-4.7",
      ANTHROPIC_DEFAULT_OPUS_MODEL: "glm-4.7",
      ANTHROPIC_DEFAULT_SONNET_MODEL: "glm-4.7",
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "glm-4.7"
    }
  },

  // Sample default settings
  sampleDefaultSettings: {
    env: {
      ANTHROPIC_MODEL: "claude-3-5-sonnet-20241022"
    }
  },

  // Test flags and arguments
  testFlags: [
    '-c',
    '--version',
    '-v',
    '--help',
    '-h',
    '--verbose',
    '-p',
    '--debug',
    '--test-flag',
    '-d',
    '--model=gpt4',
    '-1'
  ],

  // Test flag combinations
  testFlagCombinations: [
    ['-c'],
    ['--verbose'],
    ['-p', 'test prompt'],
    ['-c', '--verbose'],
    ['glm', '-c'],
    ['glm', '-c', '--verbose'],
    ['--version'],
    ['--help']
  ],

  // Cross-platform path test cases
  pathTestCases: [
    ['~', 'home directory expansion'],
    ['~/test', 'home subdirectory'],
    ['.', 'current directory'],
    ['..', 'parent directory'],
    ['/tmp', 'absolute path'],
    ['relative/path', 'relative path'],
    ['path with spaces', 'path containing spaces']
  ],

  // Expected output patterns
  expectedPatterns: {
    version: /\b(2\.\d+\.\d+)\b/,
    help: /usage|help|options/i,
    error: /error|failed|not found/i,
    success: /\[OK\]|\[✓\]|success/i
  },

  // Mock file system paths for testing
  mockPaths: {
    homeDir: process.env.HOME || process.env.USERPROFILE || '/tmp/test-home',
    ccsDir: '~/.ccs',
    configFile: '~/.ccs/config.json',
    glmFile: '~/.ccs/glm.settings.json',
    versionFile: '~/.ccs/VERSION'
  },

  // Test environment variables
  testEnvVars: {
    NO_COLOR: '1',
    CI: 'true',
    NODE_ENV: 'test'
  }
};