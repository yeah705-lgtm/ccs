/**
 * OAuth Auth Flow Hook for CLIProxy
 * Manages popup-based OAuth authentication flows
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface AuthFlowState {
  provider: string | null;
  isAuthenticating: boolean;
  error: string | null;
}

const AUTH_ENDPOINTS: Record<string, string> = {
  claude: '/anthropic-auth-url',
  gemini: '/gemini-cli-auth-url',
  codex: '/codex-auth-url',
  agy: '/antigravity-auth-url',
};

const AUTH_TIMEOUT_MS = 300000; // 5 minutes
const POLL_INTERVAL_MS = 500;

export function useCliproxyAuthFlow() {
  const [state, setState] = useState<AuthFlowState>({
    provider: null,
    isAuthenticating: false,
    error: null,
  });

  const popupRef = useRef<Window | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  // Cleanup function
  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const startAuth = useCallback(
    async (provider: string) => {
      const endpoint = AUTH_ENDPOINTS[provider];
      if (!endpoint) {
        setState({
          provider: null,
          isAuthenticating: false,
          error: `Unknown provider: ${provider}`,
        });
        return;
      }

      setState({ provider, isAuthenticating: true, error: null });

      try {
        // Get auth URL from API
        const response = await fetch(`/api/cliproxy${endpoint}?is_webui=true`);
        if (!response.ok) {
          throw new Error(`Failed to get auth URL: ${response.statusText}`);
        }

        const data = await response.json();
        const { url, state: authState } = data;

        if (!url) {
          throw new Error('No auth URL returned from server');
        }

        // Open popup
        const popup = window.open(url, `${provider}_auth`, 'width=600,height=700,popup=yes');

        if (!popup) {
          throw new Error('Popup blocked. Please allow popups for this site.');
        }

        popupRef.current = popup;

        // Poll for completion
        pollIntervalRef.current = setInterval(async () => {
          // Check if popup was closed by user
          if (popup.closed) {
            cleanup();
            // Check final status
            try {
              const statusRes = await fetch(`/api/cliproxy/get-auth-status?state=${authState}`);
              const statusData = await statusRes.json();

              if (statusData.status === 'ok') {
                queryClient.invalidateQueries({ queryKey: ['cliproxy-auth'] });
                toast.success(`${provider} authentication successful`);
                setState({ provider: null, isAuthenticating: false, error: null });
              } else if (statusData.status === 'error') {
                setState({
                  provider: null,
                  isAuthenticating: false,
                  error: statusData.error || 'Authentication failed',
                });
              } else {
                // User closed popup before completing
                setState({
                  provider: null,
                  isAuthenticating: false,
                  error: 'Authentication cancelled',
                });
              }
            } catch {
              setState({
                provider: null,
                isAuthenticating: false,
                error: 'Failed to check auth status',
              });
            }
            return;
          }

          // Poll status while popup is open
          try {
            const statusRes = await fetch(`/api/cliproxy/get-auth-status?state=${authState}`);
            const statusData = await statusRes.json();

            if (statusData.status === 'ok') {
              cleanup();
              queryClient.invalidateQueries({ queryKey: ['cliproxy-auth'] });
              toast.success(`${provider} authentication successful`);
              setState({ provider: null, isAuthenticating: false, error: null });
            } else if (statusData.status === 'error') {
              cleanup();
              setState({
                provider: null,
                isAuthenticating: false,
                error: statusData.error || 'Authentication failed',
              });
            }
            // 'wait' status means keep polling
          } catch {
            // Silently ignore polling errors, will retry
          }
        }, POLL_INTERVAL_MS);

        // Timeout after 5 minutes
        timeoutRef.current = setTimeout(() => {
          cleanup();
          toast.error('Authentication timed out');
          setState({
            provider: null,
            isAuthenticating: false,
            error: 'Authentication timed out',
          });
        }, AUTH_TIMEOUT_MS);
      } catch (error) {
        cleanup();
        const message = error instanceof Error ? error.message : 'Authentication failed';
        toast.error(message);
        setState({ provider: null, isAuthenticating: false, error: message });
      }
    },
    [cleanup, queryClient]
  );

  const cancelAuth = useCallback(() => {
    cleanup();
    setState({ provider: null, isAuthenticating: false, error: null });
  }, [cleanup]);

  return {
    ...state,
    startAuth,
    cancelAuth,
  };
}
