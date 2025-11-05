#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { showError, colors } = require('./helpers');
const { detectClaudeCli, showClaudeNotFoundError } = require('./claude-detector');
const { getSettingsPath } = require('./config-manager');

// Version (sync with package.json)
const CCS_VERSION = require('../package.json').version;

// Special command handlers
function handleVersionCommand() {
  console.log(`CCS (Claude Code Switch) version ${CCS_VERSION}`);

  // Show install location
  const installLocation = process.argv[1];
  if (installLocation) {
    console.log(`Installed at: ${installLocation}`);
  }

  console.log('https://github.com/kaitranntt/ccs');
  process.exit(0);
}

function handleHelpCommand(remainingArgs) {
  const claudeCli = detectClaudeCli();

  // Execute claude --help
  const child = spawn(claudeCli, ['--help', ...remainingArgs], { stdio: 'inherit' });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code || 0);
    }
  });

  child.on('error', (err) => {
    showClaudeNotFoundError();
    process.exit(1);
  });
}

function handleInstallCommand() {
  // Implementation for --install (copy commands/skills to ~/.claude)
  console.log('[Installing CCS Commands and Skills]');
  console.log('Feature not yet implemented in Node.js standalone');
  console.log('Use traditional installer for now:');
  console.log(process.platform === 'win32'
    ? '  irm ccs.kaitran.ca/install | iex'
    : '  curl -fsSL ccs.kaitran.ca/install | bash');
  process.exit(0);
}

function handleUninstallCommand() {
  // Implementation for --uninstall (remove commands/skills from ~/.claude)
  console.log('[Uninstalling CCS Commands and Skills]');
  console.log('Feature not yet implemented in Node.js standalone');
  console.log('Use traditional uninstaller for now');
  process.exit(0);
}

// Smart profile detection
function detectProfile(args) {
  if (args.length === 0 || args[0].startsWith('-')) {
    // No args or first arg is a flag → use default profile
    return { profile: 'default', remainingArgs: args };
  } else {
    // First arg doesn't start with '-' → treat as profile name
    return { profile: args[0], remainingArgs: args.slice(1) };
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);

  // Special case: version command (check BEFORE profile detection)
  const firstArg = args[0];
  if (firstArg === 'version' || firstArg === '--version' || firstArg === '-v') {
    handleVersionCommand();
  }

  // Special case: help command
  if (firstArg === '--help' || firstArg === '-h' || firstArg === 'help') {
    const remainingArgs = args.slice(1);
    handleHelpCommand(remainingArgs);
    return;
  }

  // Special case: install command
  if (firstArg === '--install') {
    handleInstallCommand();
    return;
  }

  // Special case: uninstall command
  if (firstArg === '--uninstall') {
    handleUninstallCommand();
    return;
  }

  // Detect profile
  const { profile, remainingArgs } = detectProfile(args);

  // Special case: "default" profile just runs claude directly
  if (profile === 'default') {
    const claudeCli = detectClaudeCli();

    // Execute claude with args
    const child = spawn(claudeCli, remainingArgs, { stdio: 'inherit' });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
      } else {
        process.exit(code || 0);
      }
    });

    child.on('error', (err) => {
      showClaudeNotFoundError();
      process.exit(1);
    });

    return;
  }

  // Get settings path for profile
  const settingsPath = getSettingsPath(profile);

  // Detect Claude CLI
  const claudeCli = detectClaudeCli();

  // Execute claude with --settings
  const claudeArgs = ['--settings', settingsPath, ...remainingArgs];
  const child = spawn(claudeCli, claudeArgs, { stdio: 'inherit' });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code || 0);
    }
  });

  child.on('error', (err) => {
    showClaudeNotFoundError();
    process.exit(1);
  });
}

// Run main
main();