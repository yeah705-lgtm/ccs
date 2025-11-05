'use strict';

const fs = require('fs');
const { showError, expandPath } = require('./helpers');

// Detect Claude CLI executable
function detectClaudeCli() {
  // Priority 1: CCS_CLAUDE_PATH environment variable (if user wants custom path)
  if (process.env.CCS_CLAUDE_PATH) {
    const ccsPath = expandPath(process.env.CCS_CLAUDE_PATH);
    // Basic validation: file exists
    if (fs.existsSync(ccsPath)) {
      return ccsPath;
    }
    // Invalid CCS_CLAUDE_PATH - show warning and fall back to PATH
    console.warn('[!] Warning: CCS_CLAUDE_PATH is set but file not found:', ccsPath);
    console.warn('    Falling back to system PATH lookup...');
  }

  // Priority 2: Use 'claude' from PATH (trust the system)
  // This is the standard case - if user installed Claude CLI, it's in their PATH
  return 'claude';
}

// Show Claude not found error
function showClaudeNotFoundError() {
  const isWindows = process.platform === 'win32';

  const errorMsg = `Claude CLI not found in PATH

CCS requires Claude CLI to be installed and available in your PATH.

Solutions:
  1. Install Claude CLI:
     https://docs.claude.com/en/docs/claude-code/installation

  2. Verify installation:
     ${isWindows ? 'Get-Command claude' : 'command -v claude'}

  3. If installed but not in PATH, add it:
     # Find Claude installation
     ${isWindows ? 'where.exe claude' : 'which claude'}

     # Or set custom path
     ${isWindows
       ? '$env:CCS_CLAUDE_PATH = \'C:\\path\\to\\claude.exe\''
       : 'export CCS_CLAUDE_PATH=\'/path/to/claude\''
     }

Restart your terminal after installation.`;

  showError(errorMsg);
}

module.exports = {
  detectClaudeCli,
  showClaudeNotFoundError
};