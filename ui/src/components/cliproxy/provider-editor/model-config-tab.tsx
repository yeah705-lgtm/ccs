/**
 * Model Config Tab
 * Contains model config section, accounts section, and provider-specific settings
 */

import { useCallback, useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ModelConfigSection } from './model-config-section';
import { AccountsSection } from './accounts-section';
import { api } from '@/lib/api-client';
import type { ProviderCatalog } from '../provider-model-selector';
import type { OAuthAccount } from '@/lib/api-client';
import { QUOTA_SUPPORTED_PROVIDERS, type QuotaSupportedProvider } from '@/hooks/use-cliproxy-stats';

interface ModelConfigTabProps {
  provider: string;
  catalog?: ProviderCatalog;
  savedPresets: Array<{
    name: string;
    default: string;
    opus: string;
    sonnet: string;
    haiku: string;
  }>;
  currentModel?: string;
  opusModel?: string;
  sonnetModel?: string;
  haikuModel?: string;
  providerModels: Array<{ id: string; owned_by: string }>;
  onApplyPreset: (updates: Record<string, string>) => void;
  onUpdateEnvValue: (key: string, value: string) => void;
  onOpenCustomPreset: () => void;
  onDeletePreset: (name: string) => void;
  isDeletePending?: boolean;
  accounts: OAuthAccount[];
  onAddAccount: () => void;
  onSetDefault: (accountId: string) => void;
  onRemoveAccount: (accountId: string) => void;
  onPauseToggle?: (accountId: string, paused: boolean) => void;
  /** Solo mode: activate one account, pause all others */
  onSoloMode?: (accountId: string) => void;
  isRemovingAccount?: boolean;
  /** Pause/resume mutation in progress */
  isPausingAccount?: boolean;
  /** Solo mode mutation in progress */
  isSoloingAccount?: boolean;
  /** Bulk pause multiple accounts */
  onBulkPause?: (accountIds: string[]) => void;
  /** Bulk resume multiple accounts */
  onBulkResume?: (accountIds: string[]) => void;
  /** Bulk pause mutation in progress */
  isBulkPausing?: boolean;
  /** Bulk resume mutation in progress */
  isBulkResuming?: boolean;
  /** Weight change handler */
  onWeightChange?: (accountId: string, weight: number) => void;
  /** Account ID currently having weight updated (null if none) */
  updatingWeightAccountId?: string | null;
  /** Set all Ultra account weights */
  onSetAllUltraWeights?: (weight: number) => void;
  /** Set tier defaults mutation in progress */
  isSettingWeights?: boolean;
  /** Trigger manual weight sync */
  onSyncWeights?: () => void;
  /** Weight sync mutation in progress */
  isSyncingWeights?: boolean;
  privacyMode?: boolean;
  /** True if connected to remote CLIProxy (quota not available) */
  isRemoteMode?: boolean;
}

export function ModelConfigTab({
  provider,
  catalog,
  savedPresets,
  currentModel,
  opusModel,
  sonnetModel,
  haikuModel,
  providerModels,
  onApplyPreset,
  onUpdateEnvValue,
  onOpenCustomPreset,
  onDeletePreset,
  isDeletePending,
  accounts,
  onAddAccount,
  onSetDefault,
  onRemoveAccount,
  onPauseToggle,
  onSoloMode,
  onBulkPause,
  onBulkResume,
  onWeightChange,
  onSetAllUltraWeights,
  isRemovingAccount,
  isPausingAccount,
  isSoloingAccount,
  isBulkPausing,
  isBulkResuming,
  updatingWeightAccountId,
  isSettingWeights,
  onSyncWeights,
  isSyncingWeights,
  privacyMode,
  isRemoteMode,
}: ModelConfigTabProps) {
  // Kiro-specific: no-incognito setting (defaults to true = normal browser)
  const isKiro = provider === 'kiro';
  const [kiroNoIncognito, setKiroNoIncognito] = useState(true);
  const [kiroSettingsLoading, setKiroSettingsLoading] = useState(true);
  const [kiroSaving, setKiroSaving] = useState(false);

  // Fetch Kiro settings from unified config
  const fetchKiroSettings = useCallback(async () => {
    if (!isKiro) return;
    try {
      setKiroSettingsLoading(true);
      const unifiedConfig = await api.config.get();
      const cliproxyConfig = unifiedConfig.cliproxy as { kiro_no_incognito?: boolean } | undefined;
      setKiroNoIncognito(cliproxyConfig?.kiro_no_incognito ?? true);
    } catch {
      setKiroNoIncognito(true);
    } finally {
      setKiroSettingsLoading(false);
    }
  }, [isKiro]);

  // Save Kiro no-incognito setting
  const saveKiroNoIncognito = useCallback(async (enabled: boolean) => {
    setKiroNoIncognito(enabled); // Optimistic update
    setKiroSaving(true);
    try {
      const unifiedConfig = await api.config.get();
      const existingCliproxy = (unifiedConfig.cliproxy ?? {}) as Record<string, unknown>;
      await api.config.update({
        ...unifiedConfig,
        cliproxy: {
          ...existingCliproxy,
          kiro_no_incognito: enabled,
        },
      });
    } catch {
      setKiroNoIncognito(!enabled); // Revert on error
    } finally {
      setKiroSaving(false);
    }
  }, []);

  // Load Kiro settings on mount
  useEffect(() => {
    fetchKiroSettings();
  }, [fetchKiroSettings]);

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-6">
        <ModelConfigSection
          catalog={catalog}
          savedPresets={savedPresets}
          currentModel={currentModel}
          opusModel={opusModel}
          sonnetModel={sonnetModel}
          haikuModel={haikuModel}
          providerModels={providerModels}
          onApplyPreset={onApplyPreset}
          onUpdateEnvValue={onUpdateEnvValue}
          onOpenCustomPreset={onOpenCustomPreset}
          onDeletePreset={onDeletePreset}
          isDeletePending={isDeletePending}
        />
        <Separator />
        <AccountsSection
          accounts={accounts}
          onAddAccount={onAddAccount}
          onSetDefault={onSetDefault}
          onRemoveAccount={onRemoveAccount}
          onPauseToggle={onPauseToggle}
          onSoloMode={onSoloMode}
          onBulkPause={onBulkPause}
          onBulkResume={onBulkResume}
          onWeightChange={onWeightChange}
          onSetAllUltraWeights={onSetAllUltraWeights}
          isRemovingAccount={isRemovingAccount}
          isPausingAccount={isPausingAccount}
          isSoloingAccount={isSoloingAccount}
          isBulkPausing={isBulkPausing}
          isBulkResuming={isBulkResuming}
          updatingWeightAccountId={updatingWeightAccountId}
          isSettingWeights={isSettingWeights}
          onSyncWeights={onSyncWeights}
          isSyncingWeights={isSyncingWeights}
          privacyMode={privacyMode}
          showQuota={
            QUOTA_SUPPORTED_PROVIDERS.includes(provider as QuotaSupportedProvider) && !isRemoteMode
          }
          isKiro={isKiro}
          kiroNoIncognito={kiroNoIncognito}
          onKiroNoIncognitoChange={saveKiroNoIncognito}
          kiroSettingsLoading={kiroSettingsLoading || kiroSaving}
        />
      </div>
    </ScrollArea>
  );
}
