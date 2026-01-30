/**
 * Type definitions for ProviderEditor components
 */

import type { AuthStatus, OAuthAccount } from '@/lib/api-client';
import type { ProviderCatalog } from '../provider-model-selector';

export interface SettingsResponse {
  profile: string;
  settings: {
    env?: Record<string, string>;
  };
  mtime: number;
  path: string;
}

export interface ProviderEditorProps {
  provider: string;
  displayName: string;
  authStatus: AuthStatus;
  catalog?: ProviderCatalog;
  /** Provider type for logo display (defaults to provider) */
  logoProvider?: string;
  /** Base provider for model filtering (defaults to provider). For variants, this is the parent provider. */
  baseProvider?: string;
  /** True if using remote CLIProxy mode (hides local paths) */
  isRemoteMode?: boolean;
  /** Port number for variant (for display in header) */
  port?: number;
  onAddAccount: () => void;
  onSetDefault: (accountId: string) => void;
  onRemoveAccount: (accountId: string) => void;
  onPauseToggle?: (accountId: string, paused: boolean) => void;
  /** Solo mode: activate one account, pause all others */
  onSoloMode?: (accountId: string) => void;
  /** Bulk pause multiple accounts */
  onBulkPause?: (accountIds: string[]) => void;
  /** Bulk resume multiple accounts */
  onBulkResume?: (accountIds: string[]) => void;
  /** Weight change handler */
  onWeightChange?: (accountId: string, weight: number) => void;
  /** Set all Ultra account weights */
  onSetAllUltraWeights?: (weight: number) => void;
  isRemovingAccount?: boolean;
  /** Pause/resume mutation in progress */
  isPausingAccount?: boolean;
  /** Solo mode mutation in progress */
  isSoloingAccount?: boolean;
  /** Bulk pause mutation in progress */
  isBulkPausing?: boolean;
  /** Bulk resume mutation in progress */
  isBulkResuming?: boolean;
  /** Account ID currently having weight updated (null if none) */
  updatingWeightAccountId?: string | null;
  /** Set tier defaults mutation in progress */
  isSettingWeights?: boolean;
  /** Trigger manual weight sync */
  onSyncWeights?: () => void;
  /** Weight sync mutation in progress */
  isSyncingWeights?: boolean;
}

export interface AccountItemProps {
  account: OAuthAccount;
  onSetDefault: () => void;
  onRemove: () => void;
  onPauseToggle?: (paused: boolean) => void;
  /** Solo mode: activate this account, pause all others */
  onSoloMode?: () => void;
  /** Weight change handler */
  onWeightChange?: (weight: number) => void;
  isRemoving?: boolean;
  /** Pause/resume mutation in progress */
  isPausingAccount?: boolean;
  /** Solo mode mutation in progress */
  isSoloingAccount?: boolean;
  /** Whether this specific account's weight is being updated */
  isUpdatingWeight?: boolean;
  privacyMode?: boolean;
  /** Show quota bar (only for 'agy' provider) */
  showQuota?: boolean;
  /** Enable checkbox for multi-select */
  selectable?: boolean;
  /** Whether this account is currently selected */
  selected?: boolean;
  /** Called when checkbox is toggled */
  onSelectChange?: (selected: boolean) => void;
}

export interface ModelMappingValues {
  default: string;
  opus: string;
  sonnet: string;
  haiku: string;
}

export interface CustomPresetDialogProps {
  open: boolean;
  onClose: () => void;
  currentValues: ModelMappingValues;
  onApply: (values: ModelMappingValues, presetName?: string) => void;
  onSave?: (values: ModelMappingValues, presetName?: string) => void;
  isSaving?: boolean;
  catalog?: ProviderCatalog;
  allModels: { id: string; owned_by: string }[];
}

export interface RawEditorSectionProps {
  rawJsonContent: string;
  isRawJsonValid: boolean;
  rawJsonEdits: string | null;
  onRawJsonChange: (value: string) => void;
  profileEnv?: Record<string, string>;
  /** List of required env vars that are missing (empty if all present) */
  missingRequiredFields?: string[];
}

export interface ModelConfigSectionProps {
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
}

export interface UseProviderEditorReturn {
  data: SettingsResponse | undefined;
  isLoading: boolean;
  refetch: () => void;
  rawJsonContent: string;
  rawJsonEdits: string | null;
  isRawJsonValid: boolean;
  hasChanges: boolean;
  currentSettings: { env?: Record<string, string> };
  currentModel?: string;
  opusModel?: string;
  sonnetModel?: string;
  haikuModel?: string;
  handleRawJsonChange: (value: string) => void;
  updateEnvValue: (key: string, value: string) => void;
  updateEnvValues: (updates: Record<string, string>) => void;
  saveMutation: {
    mutate: () => void;
    isPending: boolean;
  };
  conflictDialog: boolean;
  setConflictDialog: (open: boolean) => void;
  handleConflictResolve: (overwrite: boolean) => Promise<void>;
  /** List of required env vars that are missing (empty if all present) */
  missingRequiredFields: string[];
}
