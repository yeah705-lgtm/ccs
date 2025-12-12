/**
 * CLIProxy Control Panel Page
 *
 * Dedicated page for the CLIProxy management panel.
 */

import { ControlPanelEmbed } from '@/components/cliproxy/control-panel-embed';

export function CliproxyControlPanelPage() {
  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      <ControlPanelEmbed />
    </div>
  );
}
