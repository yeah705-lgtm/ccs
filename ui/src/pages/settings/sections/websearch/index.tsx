/**
 * WebSearch Section
 * Settings section for WebSearch providers (Gemini, OpenCode, Grok)
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, CheckCircle2, AlertCircle, Package } from 'lucide-react';
import { useWebSearchConfig, useRawConfig } from '../../hooks';
import { ProviderCard } from './provider-card';

export default function WebSearchSection() {
  const {
    config,
    status,
    loading,
    statusLoading,
    saving,
    error,
    success,
    geminiModelInput,
    setGeminiModelInput,
    opencodeModelInput,
    setOpencodeModelInput,
    geminiModelSaved,
    opencodeModelSaved,
    fetchConfig,
    fetchStatus,
    saveConfig,
    saveGeminiModel,
    saveOpencodeModel,
  } = useWebSearchConfig();

  const { fetchRawConfig } = useRawConfig();

  // Collapsible install hints state
  const [showGeminiHint, setShowGeminiHint] = useState(false);
  const [showOpencodeHint, setShowOpencodeHint] = useState(false);
  const [showGrokHint, setShowGrokHint] = useState(false);

  // Load data on mount
  useEffect(() => {
    fetchConfig();
    fetchStatus();
    fetchRawConfig();
  }, [fetchConfig, fetchStatus, fetchRawConfig]);

  const isGeminiEnabled = config?.providers?.gemini?.enabled ?? false;
  const isGrokEnabled = config?.providers?.grok?.enabled ?? false;
  const isOpenCodeEnabled = config?.providers?.opencode?.enabled ?? false;

  const toggleGemini = () => {
    const providers = config?.providers || {};
    const currentState = providers.gemini?.enabled ?? false;
    saveConfig({
      enabled: !currentState || isGrokEnabled || isOpenCodeEnabled,
      providers: { ...providers, gemini: { ...providers.gemini, enabled: !currentState } },
    });
  };

  const toggleGrok = () => {
    const providers = config?.providers || {};
    const currentState = providers.grok?.enabled ?? false;
    saveConfig({
      enabled: isGeminiEnabled || !currentState || isOpenCodeEnabled,
      providers: { ...providers, grok: { ...providers.grok, enabled: !currentState } },
    });
  };

  const toggleOpenCode = () => {
    const providers = config?.providers || {};
    const currentState = providers.opencode?.enabled ?? false;
    saveConfig({
      enabled: isGeminiEnabled || isGrokEnabled || !currentState,
      providers: { ...providers, opencode: { ...providers.opencode, enabled: !currentState } },
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Toast-style alerts */}
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
          <p className="text-sm text-muted-foreground">
            CLI-based web search for third-party profiles (gemini, codex, agy, etc.)
          </p>

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

            {/* Empty state when no providers available */}
            {!status?.geminiCli && !status?.opencodeCli && !status?.grokCli && !statusLoading && (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg text-center bg-muted/30">
                <Package className="w-12 h-12 text-muted-foreground mb-3 opacity-30" />
                <p className="font-medium text-foreground mb-1">No providers configured</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Install CLI tools to enable web search providers
                </p>
                <Button variant="outline" size="sm" onClick={fetchStatus}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Check for providers
                </Button>
              </div>
            )}

            <ProviderCard
              name="gemini"
              label="Google Gemini CLI (1000 req/day free)"
              badge="FREE"
              badgeColor="green"
              enabled={isGeminiEnabled}
              installed={status?.geminiCli?.installed ?? false}
              statusLoading={statusLoading}
              saving={saving}
              onToggle={toggleGemini}
              modelInput={geminiModelInput}
              setModelInput={setGeminiModelInput}
              onModelBlur={saveGeminiModel}
              modelSaved={geminiModelSaved}
              modelPlaceholder="gemini-2.5-flash"
              showHint={showGeminiHint}
              setShowHint={setShowGeminiHint}
              installCmd="npm install -g @google/gemini-cli"
              docsUrl="https://github.com/google-gemini/gemini-cli"
              hintColor="amber"
            />

            <ProviderCard
              name="opencode"
              label="OpenCode (web search via Zen)"
              badge="FREE"
              badgeColor="green"
              enabled={isOpenCodeEnabled}
              installed={status?.opencodeCli?.installed ?? false}
              statusLoading={statusLoading}
              saving={saving}
              onToggle={toggleOpenCode}
              modelInput={opencodeModelInput}
              setModelInput={setOpencodeModelInput}
              onModelBlur={saveOpencodeModel}
              modelSaved={opencodeModelSaved}
              modelPlaceholder="opencode/grok-code"
              showHint={showOpencodeHint}
              setShowHint={setShowOpencodeHint}
              installCmd="curl -fsSL https://opencode.ai/install | bash"
              docsUrl="https://github.com/sst/opencode"
              hintColor="purple"
            />

            <ProviderCard
              name="grok"
              label="xAI Grok CLI (web + X search)"
              badge="GROK_API_KEY"
              badgeColor="blue"
              enabled={isGrokEnabled}
              installed={status?.grokCli?.installed ?? false}
              statusLoading={statusLoading}
              saving={saving}
              onToggle={toggleGrok}
              showHint={showGrokHint}
              setShowHint={setShowGrokHint}
              installCmd="npm install -g @vibe-kit/grok-cli"
              docsUrl="https://github.com/superagent-ai/grok-cli"
              hintColor="blue"
            />
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
    </>
  );
}
