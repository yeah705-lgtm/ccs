/**
 * CLIProxy Lifecycle Management
 *
 * Handles:
 * - ccs cliproxy status
 * - ccs cliproxy stop
 */

import { initUI, header, color, dim, ok, warn, info } from '../../utils/ui';
import { getProxyStatus, stopProxy } from '../../cliproxy/services';

export async function handleProxyStatus(): Promise<void> {
  await initUI();
  console.log(header('CLIProxy Status'));
  console.log('');

  const status = getProxyStatus();
  if (status.running) {
    console.log(`  Status:     ${color('Running', 'success')}`);
    console.log(`  PID:        ${status.pid}`);
    console.log(`  Port:       ${status.port}`);
    console.log(`  Sessions:   ${status.sessionCount || 0} active`);
    if (status.startedAt) {
      console.log(`  Started:    ${new Date(status.startedAt).toLocaleString()}`);
    }
    console.log('');
    console.log(dim('To stop: ccs cliproxy stop'));
  } else {
    console.log(`  Status:     ${color('Not running', 'warning')}`);
    console.log('');
    console.log(dim('CLIProxy starts automatically when you run ccs gemini, codex, etc.'));
  }
  console.log('');
}

export async function handleStop(): Promise<void> {
  await initUI();
  console.log(header('Stop CLIProxy'));
  console.log('');

  const result = await stopProxy();
  if (result.stopped) {
    console.log(ok(`CLIProxy stopped (PID ${result.pid})`));
    if (result.sessionCount && result.sessionCount > 0) {
      console.log(info(`${result.sessionCount} active session(s) were disconnected`));
    }
  } else {
    console.log(warn(result.error || 'Failed to stop CLIProxy'));
  }
  console.log('');
}
