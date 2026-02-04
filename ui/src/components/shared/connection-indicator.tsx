/**
 * Connection Indicator (Phase 04)
 *
 * Shows WebSocket connection status in the header with reconnection state.
 */

import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useWebSocket } from '@/hooks/use-websocket';

export function ConnectionIndicator() {
  const { status, isReconnecting } = useWebSocket();

  const statusConfig = {
    connected: { icon: Wifi, color: 'text-green-600', label: 'Connected', animate: false },
    connecting: {
      icon: RefreshCw,
      color: 'text-yellow-500',
      label: 'Connecting...',
      animate: true,
    },
    disconnected: {
      icon: isReconnecting ? RefreshCw : WifiOff,
      color: isReconnecting ? 'text-amber-500' : 'text-red-500',
      label: isReconnecting ? 'Reconnecting...' : 'Disconnected',
      animate: isReconnecting,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-1 text-sm ${config.color}`}>
      <Icon className={`w-4 h-4 ${config.animate ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">{config.label}</span>
    </div>
  );
}
