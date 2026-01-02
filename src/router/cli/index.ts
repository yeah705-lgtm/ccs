// Router CLI Commands - Handler-based (no commander)
import { listCommand } from './list';
import { createCommand } from './create';
import { runCommand } from './run';
import { providersCommand } from './providers';
import { testCommand } from './test';

export interface RouterCommandResult {
  handled: boolean;
}

/**
 * Handle router subcommands
 * @param args - Arguments after 'router' (e.g., ['list', '--verbose'])
 * @returns Whether the command was handled
 */
export async function handleRouterCommand(args: string[]): Promise<RouterCommandResult> {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case 'list':
    case 'ls': {
      const verbose = subArgs.includes('-v') || subArgs.includes('--verbose');
      await listCommand({ verbose });
      return { handled: true };
    }

    case 'create': {
      const name = subArgs.find((a) => !a.startsWith('-'));
      if (!name) {
        console.log('[X] Usage: ccs router create <name> [options]');
        process.exit(1);
      }
      const copy = getArgValue(subArgs, '--copy');
      const fromPreset = getArgValue(subArgs, '--from-preset');
      const description = getArgValue(subArgs, '-d') || getArgValue(subArgs, '--description');
      await createCommand(name, { copy, fromPreset, description });
      return { handled: true };
    }

    case 'run': {
      const profileName = subArgs.find((a) => !a.startsWith('-'));
      if (!profileName) {
        console.log('[X] Usage: ccs router run <profile> [options]');
        process.exit(1);
      }
      const debug = subArgs.includes('--debug');
      const portStr = getArgValue(subArgs, '--port');
      let port: number | undefined;
      if (portStr) {
        port = parseInt(portStr, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          console.log(`[X] Invalid port: ${portStr} (must be 1-65535)`);
          process.exit(1);
        }
      }
      await runCommand(profileName, { debug, port });
      return { handled: true };
    }

    case 'providers': {
      const type = getArgValue(subArgs, '-t') || getArgValue(subArgs, '--type');
      const health = subArgs.includes('--health');
      await providersCommand({
        type: type as 'cliproxy' | 'api' | 'all' | undefined,
        health,
      });
      return { handled: true };
    }

    case 'test': {
      const profileName = subArgs.find((a) => !a.startsWith('-'));
      if (!profileName) {
        console.log('[X] Usage: ccs router test <profile>');
        process.exit(1);
      }
      const verbose = subArgs.includes('-v') || subArgs.includes('--verbose');
      await testCommand(profileName, { verbose });
      return { handled: true };
    }

    case 'help':
    case '--help':
    case '-h':
      showRouterHelp();
      return { handled: true };

    default:
      if (!subcommand) {
        showRouterHelp();
      } else {
        console.log(`[X] Unknown router command: ${subcommand}`);
        showRouterHelp();
      }
      return { handled: true };
  }
}

/**
 * Extract value for a flag argument
 */
function getArgValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx >= 0 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

/**
 * Show router help
 */
function showRouterHelp(): void {
  console.log(`
Usage: ccs router <command> [options]

Multi-provider router management

Commands:
  list [--verbose]              List all router profiles
  create <name> [options]       Create a new router profile
    --copy <profile>            Copy from existing profile
    --from-preset <preset>      Use preset (balanced, budget, premium)
    -d, --description <text>    Profile description
  run <profile> [options]       Run Claude CLI with router profile
    --debug                     Show routing debug info
    --port <port>               Router port (default: 9400)
  providers [options]           List available providers
    -t, --type <type>           Filter by type (cliproxy, api)
    --health                    Show health status
  test <profile>                Test router profile configuration

Examples:
  ccs router list
  ccs router create a1 --from-preset balanced
  ccs router test a1
  ccs router run a1 --debug
  ccs router providers --health
`);
}

// Re-export individual commands for direct use
export { listCommand } from './list';
export { createCommand } from './create';
export { runCommand } from './run';
export { providersCommand } from './providers';
export { testCommand } from './test';
