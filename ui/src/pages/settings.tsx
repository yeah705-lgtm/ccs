/**
 * Settings Page - WebSearch Configuration
 * Configure MCP-based web search for third-party profiles
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Globe, RefreshCw, CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface WebSearchConfig {
  enabled: boolean;
  provider: 'auto' | 'web-search-prime' | 'brave' | 'tavily';
  fallback: boolean;
}

interface WebSearchStatus {
  geminiCli: {
    installed: boolean;
    path: string | null;
    version: string | null;
  };
  mcpServers: {
    configured: boolean;
    ccsManaged: string[];
    userAdded: string[];
  };
  readiness: {
    status: 'ready' | 'mcp-only' | 'unavailable';
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

  // Load config and status on mount
  useEffect(() => {
    fetchConfig();
    fetchStatus();
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

  const saveConfig = async (updates: Partial<WebSearchConfig>) => {
    if (!config) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const res = await fetch('/api/websearch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, ...updates }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await res.json();
      setConfig(data.websearch);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading configuration...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500/50 bg-green-500/5">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-600">
            Settings saved successfully
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            WebSearch Configuration
          </CardTitle>
          <CardDescription>
            Configure MCP-based web search for third-party profiles (gemini, agy, codex, qwen, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-blue-500/50 bg-blue-500/5">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-600">
              Third-party profiles cannot use Anthropic&apos;s native WebSearch. CCS automatically
              configures MCP web search servers as a fallback.
            </AlertDescription>
          </Alert>

          {/* WebSearch Status Panel */}
          <div className="space-y-4 pb-4 border-b">
            <h4 className="font-medium flex items-center gap-2">
              Status
              <Button variant="ghost" size="sm" onClick={fetchStatus} disabled={statusLoading}>
                <RefreshCw className={`w-3 h-3 ${statusLoading ? 'animate-spin' : ''}`} />
              </Button>
            </h4>

            {statusLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Checking status...
              </div>
            ) : status ? (
              <div className="space-y-3">
                {/* Overall Readiness */}
                <div className="flex items-center gap-2">
                  {status.readiness.status === 'ready' && (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  )}
                  {status.readiness.status === 'mcp-only' && (
                    <Info className="w-4 h-4 text-blue-600" />
                  )}
                  {status.readiness.status === 'unavailable' && (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className="font-medium">{status.readiness.message}</span>
                </div>

                {/* Gemini CLI Status */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div
                    className={`w-2 h-2 rounded-full mt-2 ${
                      status.geminiCli.installed ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                  <div className="flex-1">
                    <p className="font-medium">Gemini CLI</p>
                    {status.geminiCli.installed ? (
                      <p className="text-sm text-muted-foreground">
                        Installed {status.geminiCli.version && `(${status.geminiCli.version})`}
                      </p>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        <p>Not installed</p>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          npm install -g @google/gemini-cli
                        </code>
                      </div>
                    )}
                  </div>
                </div>

                {/* MCP Servers */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">MCP Servers</p>
                  {status.mcpServers.ccsManaged.length === 0 &&
                  status.mcpServers.userAdded.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No web search MCP configured</p>
                  ) : (
                    <div className="space-y-1">
                      {status.mcpServers.ccsManaged.map((name) => (
                        <div key={name} className="flex items-center gap-2 text-sm">
                          <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            Managed by CCS
                          </span>
                          <span>{name}</span>
                        </div>
                      ))}
                      {status.mcpServers.userAdded.map((name) => (
                        <div key={name} className="flex items-center gap-2 text-sm">
                          <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            User-added
                          </span>
                          <span>{name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Status unavailable</p>
            )}
          </div>

          <div className="space-y-4">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enabled" className="text-base">
                  Auto-Configure MCP WebSearch
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically add web search MCP servers for third-party profiles
                </p>
              </div>
              <Select
                value={config?.enabled ? 'enabled' : 'disabled'}
                onValueChange={(value) => saveConfig({ enabled: value === 'enabled' })}
                disabled={saving}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Provider Selection */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="provider" className="text-base">
                  Preferred Provider
                </Label>
                <p className="text-sm text-muted-foreground">Primary web search provider to use</p>
              </div>
              <Select
                value={config?.provider || 'auto'}
                onValueChange={(value) =>
                  saveConfig({
                    provider: value as WebSearchConfig['provider'],
                  })
                }
                disabled={saving || !config?.enabled}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Recommended)</SelectItem>
                  <SelectItem value="web-search-prime">web-search-prime</SelectItem>
                  <SelectItem value="brave">Brave Search</SelectItem>
                  <SelectItem value="tavily">Tavily</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fallback Enable */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="fallback" className="text-base">
                  Enable Fallback Chain
                </Label>
                <p className="text-sm text-muted-foreground">
                  Add backup providers when primary is unavailable
                </p>
              </div>
              <Select
                value={config?.fallback ? 'enabled' : 'disabled'}
                onValueChange={(value) => saveConfig({ fallback: value === 'enabled' })}
                disabled={saving || !config?.enabled}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Provider Info */}
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-3">Available Providers</h4>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                <div>
                  <p className="font-medium">web-search-prime</p>
                  <p className="text-sm text-muted-foreground">
                    Requires z.ai coding plan subscription. Primary fallback option.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2" />
                <div>
                  <p className="font-medium">Brave Search</p>
                  <p className="text-sm text-muted-foreground">
                    Free tier: 15k queries/month. Set <code className="text-xs">BRAVE_API_KEY</code>{' '}
                    env var.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                <div>
                  <p className="font-medium">Tavily</p>
                  <p className="text-sm text-muted-foreground">
                    AI-optimized search (paid). Set <code className="text-xs">TAVILY_API_KEY</code>{' '}
                    env var.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={fetchConfig} disabled={loading || saving}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
