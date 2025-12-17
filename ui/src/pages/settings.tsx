/**
 * Settings Page - WebSearch Configuration
 * Supports Gemini CLI and Grok CLI providers
 */

import { useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Copy,
  Check,
  GripVertical,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { CodeEditor } from '@/components/code-editor';

interface ProviderConfig {
  enabled?: boolean;
  timeout?: number;
}

interface WebSearchProvidersConfig {
  gemini?: ProviderConfig;
  grok?: ProviderConfig;
}

interface WebSearchConfig {
  enabled: boolean;
  providers?: WebSearchProvidersConfig;
}

interface CliStatus {
  installed: boolean;
  path: string | null;
  version: string | null;
}

interface WebSearchStatus {
  geminiCli: CliStatus;
  grokCli: CliStatus;
  readiness: {
    status: 'ready' | 'unavailable';
    message: string;
  };
}

export function SettingsPage() {
  const [config, setConfig] = useState<WebSearchConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [status, setStatus] = useState<WebSearchStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  // Config viewer state
  const [rawConfig, setRawConfig] = useState<string | null>(null);
  const [rawConfigLoading, setRawConfigLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load config and status on mount
  useEffect(() => {
    fetchConfig();
    fetchStatus();
    fetchRawConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/websearch');
      if (!res.ok) throw new Error('Failed to load WebSearch config');
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      setStatusLoading(true);
      const res = await fetch('/api/websearch/status');
      if (!res.ok) throw new Error('Failed to load status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch WebSearch status:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchRawConfig = async () => {
    try {
      setRawConfigLoading(true);
      const res = await fetch('/api/config/raw');
      if (!res.ok) {
        setRawConfig(null);
        return;
      }
      const text = await res.text();
      setRawConfig(text);
    } catch (err) {
      console.error('Failed to fetch raw config:', err);
      setRawConfig(null);
    } finally {
      setRawConfigLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!rawConfig) return;
    try {
      await navigator.clipboard.writeText(rawConfig);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Toggle Gemini provider
  const toggleGemini = () => {
    const providers = config?.providers || {};
    const currentState = providers.gemini?.enabled ?? false;
    const grokState = providers.grok?.enabled ?? false;

    saveConfig({
      enabled: !currentState || grokState, // Enable WebSearch if any provider is enabled
      providers: {
        ...providers,
        gemini: {
          ...providers.gemini,
          enabled: !currentState,
        },
      },
    });
  };

  const saveConfig = async (updates: Partial<WebSearchConfig>) => {
    if (!config) return;

    // Optimistic update - apply changes immediately to local state
    const optimisticConfig = { ...config, ...updates };
    setConfig(optimisticConfig);

    try {
      setSaving(true);
      setError(null);

      const res = await fetch('/api/websearch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(optimisticConfig),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await res.json();
      setConfig(data.websearch);
      // Quick flash of success (shorter duration, less intrusive)
      setSuccess(true);
      setTimeout(() => setSuccess(false), 1500);
      // Silently refresh raw config without loading state
      fetch('/api/config/raw')
        .then((r) => (r.ok ? r.text() : null))
        .then((text) => text && setRawConfig(text))
        .catch(() => {});
    } catch (err) {
      // Revert optimistic update on error
      setConfig(config);
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const isGeminiEnabled = config?.providers?.gemini?.enabled ?? false;
  const isGrokEnabled = config?.providers?.grok?.enabled ?? false;

  // Toggle Grok provider
  const toggleGrok = () => {
    const providers = config?.providers || {};
    const currentState = providers.grok?.enabled ?? false;

    saveConfig({
      enabled: isGeminiEnabled || !currentState, // Enable WebSearch if any provider is enabled
      providers: {
        ...providers,
        grok: {
          ...providers.grok,
          enabled: !currentState,
        },
      },
    });
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-100px)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-lg">Loading configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-100px)]">
      <PanelGroup direction="horizontal" className="h-full">
        {/* Left Panel - WebSearch Controls */}
        <Panel defaultSize={40} minSize={30} maxSize={55}>
          <div className="h-full border-r flex flex-col bg-muted/30 relative">
            {/* Header */}
            <div className="p-5 border-b bg-background">
              <div className="flex items-center gap-3">
                <Globe className="w-6 h-6 text-primary" />
                <div>
                  <h1 className="text-lg font-semibold">WebSearch</h1>
                  <p className="text-sm text-muted-foreground">
                    CLI-based web search for third-party profiles
                  </p>
                </div>
              </div>
            </div>

            {/* Toast-style alerts - absolute positioned, no layout shift */}
            <div
              className={`absolute left-5 right-5 top-20 z-10 transition-all duration-200 ease-out ${
                error || success
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 -translate-y-2 pointer-events-none'
              }`}
            >
              {error && (
                <Alert variant="destructive" className="py-2 shadow-lg">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-green-200 bg-green-50 text-green-700 shadow-lg dark:border-green-900/50 dark:bg-green-900/90 dark:text-green-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">Saved</span>
                </div>
              )}
            </div>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1">
              <div className="p-5 space-y-6">
                {/* Status Summary */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">
                      {isGeminiEnabled ? 'WebSearch enabled' : 'WebSearch disabled'}
                    </p>
                    {statusLoading ? (
                      <p className="text-sm text-muted-foreground">Checking status...</p>
                    ) : status?.readiness ? (
                      <p className="text-sm text-muted-foreground">{status.readiness.message}</p>
                    ) : null}
                  </div>
                  <Button variant="ghost" size="sm" onClick={fetchStatus} disabled={statusLoading}>
                    <RefreshCw className={`w-4 h-4 ${statusLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                {/* CLI Providers */}
                <div className="space-y-3">
                  <h3 className="text-base font-medium">Providers</h3>

                  {/* Gemini CLI Provider */}
                  <div
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      isGeminiEnabled
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border bg-background'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Terminal
                        className={`w-5 h-5 ${isGeminiEnabled ? 'text-primary' : 'text-muted-foreground'}`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-medium">gemini</p>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">
                            FREE
                          </span>
                          {status?.geminiCli?.installed ? (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">
                              installed
                            </span>
                          ) : (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
                              not installed
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Google Gemini CLI (1000 req/day free)
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={isGeminiEnabled}
                      onCheckedChange={toggleGemini}
                      disabled={saving || !status?.geminiCli?.installed}
                    />
                  </div>

                  {/* Gemini Installation hint when not installed */}
                  {!status?.geminiCli?.installed && !statusLoading && (
                    <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                        Gemini CLI not installed
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                        Install globally (FREE tier available):
                      </p>
                      <code className="text-sm bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded font-mono">
                        npm install -g @google/gemini-cli
                      </code>
                      <div className="mt-3">
                        <a
                          href="https://github.com/google-gemini/gemini-cli"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-amber-700 dark:text-amber-300 hover:underline inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View documentation
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Grok CLI Provider */}
                  <div
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      isGrokEnabled
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border bg-background'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Terminal
                        className={`w-5 h-5 ${isGrokEnabled ? 'text-primary' : 'text-muted-foreground'}`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-medium">grok</p>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium">
                            GROK_API_KEY
                          </span>
                          {status?.grokCli?.installed ? (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">
                              installed
                            </span>
                          ) : (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
                              not installed
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          xAI Grok CLI (web + X search)
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={isGrokEnabled}
                      onCheckedChange={toggleGrok}
                      disabled={saving || !status?.grokCli?.installed}
                    />
                  </div>

                  {/* Grok Installation hint when not installed */}
                  {!status?.grokCli?.installed && !statusLoading && (
                    <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/20">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                        Grok CLI not installed
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                        Install globally (requires xAI API key):
                      </p>
                      <code className="text-sm bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded font-mono">
                        npm install -g @vibe-kit/grok-cli
                      </code>
                      <div className="mt-3">
                        <a
                          href="https://github.com/superagent-ai/grok-cli"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-700 dark:text-blue-300 hover:underline inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View documentation
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-4 border-t bg-background">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  fetchConfig();
                  fetchRawConfig();
                }}
                disabled={loading || saving}
                className="w-full"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle className="w-2 bg-border hover:bg-primary/20 transition-colors cursor-col-resize flex items-center justify-center group">
          <GripVertical className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
        </PanelResizeHandle>

        {/* Right Panel - Config Viewer */}
        <Panel defaultSize={60} minSize={35}>
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b bg-background flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCode className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="font-semibold">config.yaml</h2>
                  <p className="text-sm text-muted-foreground">~/.ccs/config.yaml</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyToClipboard} disabled={!rawConfig}>
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchRawConfig}
                  disabled={rawConfigLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${rawConfigLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Config Content - scrollable */}
            <div className="flex-1 overflow-auto">
              {rawConfigLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Loading...
                </div>
              ) : rawConfig ? (
                <CodeEditor
                  value={rawConfig}
                  onChange={() => {}}
                  language="yaml"
                  readonly
                  minHeight="auto"
                  className="min-h-full"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <FileCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Config file not found</p>
                    <code className="text-sm bg-muted px-2 py-1 rounded mt-2 inline-block">
                      ccs migrate
                    </code>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
