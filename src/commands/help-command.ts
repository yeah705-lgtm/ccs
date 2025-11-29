import { colored } from '../utils/helpers';

/**
 * Display comprehensive help information for CCS (Claude Code Switch)
 */
export function handleHelpCommand(): void {
  console.log(
    colored('CCS (Claude Code Switch) - Instant profile switching for Claude CLI', 'bold')
  );
  console.log('');

  console.log(colored('Usage:', 'cyan'));
  console.log(`  ${colored('ccs', 'yellow')} [profile] [claude-args...]`);
  console.log(`  ${colored('ccs', 'yellow')} [flags]`);
  console.log('');

  console.log(colored('Description:', 'cyan'));
  console.log('  Switch between multiple Claude accounts and alternative models');
  console.log('  (GLM, Kimi) instantly. Run different Claude CLI sessions concurrently');
  console.log('  with auto-recovery. Zero downtime.');
  console.log('');

  console.log(colored('Requirements:', 'cyan'));
  console.log('  Node.js 14+   (detected automatically by bootstrap)');
  console.log('  npm 5.2+      (for npx, comes with Node.js 8.2+)');
  console.log('');

  console.log(colored('Model Switching:', 'cyan'));
  console.log(`  ${colored('ccs', 'yellow')}                         Use default Claude account`);
  console.log(
    `  ${colored('ccs codex', 'yellow')}                    Codex via OAuth (zero config)`
  );
  console.log(
    `  ${colored('ccs gemini', 'yellow')}                   Gemini via OAuth (zero config)`
  );
  console.log(`  ${colored('ccs glm', 'yellow')}                      GLM 4.6 (API key required)`);
  console.log(`  ${colored('ccs glmt', 'yellow')}                     GLM with thinking mode`);
  console.log(`  ${colored('ccs kimi', 'yellow')}                     Kimi for Coding (API key)`);
  console.log(
    `  ${colored('ccs qwen', 'yellow')}                     Qwen via OAuth (zero config)`
  );
  console.log(`  ${colored('ccs gemini', 'yellow')} "explain this"   Use Gemini with prompt`);
  console.log('');

  console.log(colored('Account Management:', 'cyan'));
  console.log(
    `  ${colored('ccs auth --help', 'yellow')}             Run multiple Claude accounts concurrently`
  );
  console.log('');

  console.log(colored('Delegation (inside Claude Code CLI):', 'cyan'));
  console.log(
    `  ${colored('/ccs "task"', 'yellow')}                Delegate task (auto-selects best profile)`
  );
  console.log(
    `  ${colored('/ccs --glm "task"', 'yellow')}           Force GLM-4.6 for simple tasks`
  );
  console.log(`  ${colored('/ccs --kimi "task"', 'yellow')}          Force Kimi for long context`);
  console.log(
    `  ${colored('/ccs:continue "follow-up"', 'yellow')}    Continue last delegation session`
  );
  console.log('  Save tokens by delegating simple tasks to cost-optimized models');
  console.log('');

  console.log(colored('Diagnostics:', 'cyan'));
  console.log(
    `  ${colored('ccs doctor', 'yellow')}                  Run health check and diagnostics`
  );
  console.log(
    `  ${colored('ccs sync', 'yellow')}                    Sync delegation commands and skills`
  );
  console.log(`  ${colored('ccs update', 'yellow')}                  Update CCS to latest version`);
  console.log('');

  console.log(colored('Flags:', 'cyan'));
  console.log(`  ${colored('-h, --help', 'yellow')}                  Show this help message`);
  console.log(
    `  ${colored('-v, --version', 'yellow')}               Show version and installation info`
  );
  console.log(
    `  ${colored('-sc, --shell-completion', 'yellow')}     Install shell auto-completion`
  );
  console.log('');

  console.log(colored('Configuration:', 'cyan'));
  console.log('  Config File: ~/.ccs/config.json');
  console.log('  Profiles:    ~/.ccs/profiles.json');
  console.log('  Instances:   ~/.ccs/instances/');
  console.log('  Settings:    ~/.ccs/*.settings.json');
  console.log('  Environment: CCS_CONFIG (override config path)');
  console.log('');

  console.log(colored('Shared Data:', 'cyan'));
  console.log('  Commands:    ~/.ccs/shared/commands/');
  console.log('  Skills:      ~/.ccs/shared/skills/');
  console.log('  Agents:      ~/.ccs/shared/agents/');
  console.log('  Plugins:     ~/.ccs/shared/plugins/');
  console.log('  Note: Commands, skills, agents, and plugins are symlinked across all profiles');
  console.log('');

  console.log(colored('Examples:', 'cyan'));
  console.log(`  ${colored('$ ccs', 'yellow')}                        # Use default account`);
  console.log(`  ${colored('$ ccs gemini "explain code"', 'yellow')}  # Zero-config OAuth`);
  console.log(`  ${colored('$ ccs glm "implement API"', 'yellow')}    # Cost-optimized model`);
  console.log('');
  console.log(
    `  For more: ${colored('https://github.com/kaitranntt/ccs/blob/main/README.md', 'cyan')}`
  );
  console.log('');

  console.log(colored('Uninstall:', 'yellow'));
  console.log('  npm (recommended):  npm uninstall -g @kaitranntt/ccs');
  console.log('  Legacy (deprecated):');
  console.log('    macOS/Linux:  curl -fsSL ccs.kaitran.ca/uninstall | bash');
  console.log('    Windows:      irm ccs.kaitran.ca/uninstall | iex');
  console.log('');

  console.log(colored('Documentation:', 'cyan'));
  console.log(`  GitHub:  ${colored('https://github.com/kaitranntt/ccs', 'cyan')}`);
  console.log('  Docs:    https://github.com/kaitranntt/ccs/blob/main/README.md');
  console.log('  Issues:  https://github.com/kaitranntt/ccs/issues');
  console.log('');

  console.log(`${colored('License:', 'cyan')} MIT`);

  process.exit(0);
}
