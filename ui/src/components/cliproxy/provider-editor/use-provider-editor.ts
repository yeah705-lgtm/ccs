/**
 * useProviderEditor Hook
 * Manages query, mutation, and state logic for ProviderEditor
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { SettingsResponse, UseProviderEditorReturn } from './types';

/** Required env vars for CLIProxy providers (informational only - runtime fills defaults) */
const REQUIRED_ENV_KEYS = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN'] as const;

/** Check settings for missing fields (for UI warnings) */
function checkMissingFields(settings: { env?: Record<string, string> }): string[] {
  const env = settings?.env || {};
  return REQUIRED_ENV_KEYS.filter((key) => !env[key]?.trim());
}

export function useProviderEditor(provider: string): UseProviderEditorReturn {
  const [rawJsonEdits, setRawJsonEdits] = useState<string | null>(null);
  const [conflictDialog, setConflictDialog] = useState(false);
  const queryClient = useQueryClient();

  // Fetch settings for this provider
  const { data, isLoading, refetch } = useQuery<SettingsResponse>({
    queryKey: ['settings', provider],
    queryFn: async () => {
      const res = await fetch(`/api/settings/${provider}/raw`);
      if (!res.ok) {
        // Return empty settings for unconfigured providers
        return {
          profile: provider,
          settings: { env: {} },
          mtime: Date.now(),
          path: `~/.ccs/profiles/${provider}/settings.json`,
        };
      }
      return res.json();
    },
  });

  const settings = data?.settings;

  // Derive raw JSON content
  const rawJsonContent = useMemo(() => {
    if (rawJsonEdits !== null) return rawJsonEdits;
    if (settings) return JSON.stringify(settings, null, 2);
    return '{\n  "env": {}\n}';
  }, [rawJsonEdits, settings]);

  const handleRawJsonChange = useCallback((value: string) => {
    setRawJsonEdits(value);
  }, []);

  // Parse current settings from JSON
  const currentSettings = useMemo(() => {
    try {
      return JSON.parse(rawJsonContent);
    } catch {
      return settings || { env: {} };
    }
  }, [rawJsonContent, settings]);

  // Extract model values from settings
  const currentModel = currentSettings?.env?.ANTHROPIC_MODEL;
  const opusModel = currentSettings?.env?.ANTHROPIC_DEFAULT_OPUS_MODEL;
  const sonnetModel = currentSettings?.env?.ANTHROPIC_DEFAULT_SONNET_MODEL;
  const haikuModel = currentSettings?.env?.ANTHROPIC_DEFAULT_HAIKU_MODEL;

  // Extended context setting (stored as 'true'/'false' string)
  const extendedContextEnabled = currentSettings?.env?.CCS_EXTENDED_CONTEXT === 'true';

  // Update a single setting value
  const updateEnvValue = useCallback(
    (key: string, value: string) => {
      const newEnv = { ...(currentSettings?.env || {}), [key]: value };
      const newSettings = { ...currentSettings, env: newEnv };
      setRawJsonEdits(JSON.stringify(newSettings, null, 2));
    },
    [currentSettings]
  );

  // Toggle extended context
  const toggleExtendedContext = useCallback(
    (enabled: boolean) => {
      updateEnvValue('CCS_EXTENDED_CONTEXT', enabled ? 'true' : 'false');
    },
    [updateEnvValue]
  );

  // Batch update multiple env values at once
  const updateEnvValues = useCallback(
    (updates: Record<string, string>) => {
      const newEnv = { ...(currentSettings?.env || {}), ...updates };
      const newSettings = { ...currentSettings, env: newEnv };
      setRawJsonEdits(JSON.stringify(newSettings, null, 2));
    },
    [currentSettings]
  );

  // Check if JSON is valid
  const isRawJsonValid = useMemo(() => {
    try {
      JSON.parse(rawJsonContent);
      return true;
    } catch {
      return false;
    }
  }, [rawJsonContent]);

  // Check for unsaved changes
  const hasChanges = useMemo(() => {
    if (rawJsonEdits === null) return false;
    return rawJsonEdits !== JSON.stringify(settings, null, 2);
  }, [rawJsonEdits, settings]);

  // Validation state for missing required fields (informational warning)
  const missingFields = useMemo(() => checkMissingFields(currentSettings), [currentSettings]);

  // Save mutation (no blocking validation - runtime uses defaults)
  const saveMutation = useMutation({
    mutationFn: async () => {
      const settingsToSave = JSON.parse(rawJsonContent);

      const res = await fetch(`/api/settings/${provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: settingsToSave,
          expectedMtime: data?.mtime,
        }),
      });

      if (res.status === 409) throw new Error('CONFLICT');
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: (responseData) => {
      queryClient.invalidateQueries({ queryKey: ['settings', provider] });
      setRawJsonEdits(null);
      // Show warning if fields missing (runtime uses defaults)
      if (responseData?.warning) {
        toast.success('Settings saved', {
          description: responseData.warning,
        });
      } else {
        toast.success('Settings saved');
      }
    },
    onError: (error: Error) => {
      if (error.message === 'CONFLICT') {
        setConflictDialog(true);
      } else {
        toast.error(error.message);
      }
    },
  });

  const handleConflictResolve = async (overwrite: boolean) => {
    setConflictDialog(false);
    if (overwrite) {
      await refetch();
      saveMutation.mutate();
    } else {
      setRawJsonEdits(null);
    }
  };

  return {
    data,
    isLoading,
    refetch,
    rawJsonContent,
    rawJsonEdits,
    isRawJsonValid,
    hasChanges,
    currentSettings,
    currentModel,
    opusModel,
    sonnetModel,
    haikuModel,
    extendedContextEnabled,
    toggleExtendedContext,
    handleRawJsonChange,
    updateEnvValue,
    updateEnvValues,
    saveMutation: {
      mutate: () => saveMutation.mutate(),
      isPending: saveMutation.isPending,
    },
    conflictDialog,
    setConflictDialog,
    handleConflictResolve,
    // Validation (informational)
    missingRequiredFields: missingFields,
  };
}
