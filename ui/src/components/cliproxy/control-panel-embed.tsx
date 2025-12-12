/**
 * CLIProxy Control Panel Embed
 *
 * Embeds the CLIProxy management.html with auto-authentication.
 * Uses postMessage to inject credentials into the iframe.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, AlertCircle, Key, X, Gauge } from 'lucide-react';

/** CLIProxyAPI default port */
const CLIPROXY_DEFAULT_PORT = 8317;

/** CCS Control Panel secret - must match config-generator.ts CCS_CONTROL_PANEL_SECRET */
const CCS_CONTROL_PANEL_SECRET = 'ccs';

interface ControlPanelEmbedProps {
  port?: number;
}

export function ControlPanelEmbed({ port = CLIPROXY_DEFAULT_PORT }: ControlPanelEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showLoginHint, setShowLoginHint] = useState(true);

  const managementUrl = `http://localhost:${port}/management.html`;

  // Check if CLIProxy is running
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(`http://localhost:${port}/`, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          setIsConnected(true);
          setError(null);
        } else {
          setIsConnected(false);
          setError('CLIProxy returned an error');
        }
      } catch {
        setIsConnected(false);
        setError('CLIProxy is not running');
      }
    };

    checkConnection();
  }, [port]);

  // Handle iframe load - attempt to auto-login via postMessage
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);

    // Try to inject credentials via postMessage
    // The management.html needs to listen for this message
    // If it doesn't support it, user will see the login page
    if (iframeRef.current?.contentWindow) {
      try {
        // Send credentials to iframe
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'ccs-auto-login',
            apiBase: `http://localhost:${port}`,
            managementKey: CCS_CONTROL_PANEL_SECRET,
          },
          `http://localhost:${port}`
        );
      } catch {
        // Cross-origin restriction - expected if not same origin
        console.debug('[ControlPanelEmbed] postMessage failed - cross-origin');
      }
    }
  }, [port]);

  const handleRefresh = () => {
    setIsLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = managementUrl;
    }
  };

  // Show error state if CLIProxy is not running
  if (!isConnected && error) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">CLIProxy Control Panel</h2>
          </div>
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-muted"
            onClick={handleRefresh}
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center bg-muted/20">
          <div className="text-center max-w-md px-8">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2">CLIProxy Not Available</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <p className="text-sm text-muted-foreground">
              Start a CLIProxy session with{' '}
              <code className="bg-muted px-1 rounded">ccs gemini</code> or run{' '}
              <code className="bg-muted px-1 rounded">ccs config</code> which auto-starts it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Login hint banner */}
      {showLoginHint && !isLoading && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md text-sm">
            <Key className="h-3.5 w-3.5 text-blue-600" />
            <span>
              Key:{' '}
              <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded font-mono font-semibold">
                ccs
              </code>
            </span>
            <button
              className="text-blue-600 hover:text-blue-800 dark:hover:text-blue-400"
              onClick={() => setShowLoginHint(false)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading Control Panel...</p>
          </div>
        </div>
      )}

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src={managementUrl}
        className="flex-1 w-full border-0"
        title="CLIProxy Management Panel"
        onLoad={handleIframeLoad}
      />
    </div>
  );
}
