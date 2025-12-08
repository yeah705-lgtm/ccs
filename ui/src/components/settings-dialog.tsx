/**
 * Settings Dialog Component
 * Reusable dialog for editing profile environment variables
 * Features: masked inputs for sensitive keys, conflict detection, save/cancel
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MaskedInput } from '@/components/ui/masked-input';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Save, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Settings {
  env?: Record<string, string>;
}

interface SettingsResponse {
  profile: string;
  settings: Settings;
  mtime: number;
  path: string;
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  profileName: string | null;
}

/**
 * Inner component that manages local edits state
 * Gets unmounted/remounted via key prop when dialog closes/opens
 */
function SettingsDialogContent({
  profileName,
  onClose,
}: {
  profileName: string;
  onClose: () => void;
}) {
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});
  const [conflictDialog, setConflictDialog] = useState(false);
  const queryClient = useQueryClient();

  // Fetch settings for selected profile
  const { data, isLoading, refetch } = useQuery<SettingsResponse>({
    queryKey: ['settings', profileName],
    queryFn: () => fetch(`/api/settings/${profileName}/raw`).then((r) => r.json()),
  });

  // Derive current settings by merging original data with local edits
  const currentSettings = useMemo((): Settings | undefined => {
    const settings = data?.settings;
    if (!settings) return undefined;
    return {
      ...settings,
      env: {
        ...settings.env,
        ...localEdits,
      },
    };
  }, [data?.settings, localEdits]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const settingsToSave: Settings = {
        ...data?.settings,
        env: {
          ...data?.settings?.env,
          ...localEdits,
        },
      };

      const res = await fetch(`/api/settings/${profileName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: settingsToSave,
          expectedMtime: data?.mtime,
        }),
      });

      if (res.status === 409) {
        throw new Error('CONFLICT');
      }

      if (!res.ok) {
        throw new Error('Failed to save');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', profileName] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Settings saved');
      onClose();
    },
    onError: (error: Error) => {
      if (error.message === 'CONFLICT') {
        setConflictDialog(true);
      } else {
        toast.error(error.message);
      }
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  const handleConflictResolve = async (overwrite: boolean) => {
    setConflictDialog(false);
    if (overwrite) {
      // Refetch to get new mtime, then save
      await refetch();
      saveMutation.mutate();
    } else {
      // Discard local changes and close
      onClose();
    }
  };

  const updateEnvValue = (key: string, value: string) => {
    setLocalEdits((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const isSensitiveKey = (key: string): boolean => {
    return key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET');
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Environment Settings: {profileName}</DialogTitle>
        <DialogDescription>
          Edit environment variables for this profile. Sensitive keys are masked.
        </DialogDescription>
      </DialogHeader>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading settings...</span>
        </div>
      ) : currentSettings?.env && Object.keys(currentSettings.env).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(currentSettings.env).map(([key, value]) => (
            <div key={key}>
              <Label>{key}</Label>
              {isSensitiveKey(key) ? (
                <MaskedInput value={value} onChange={(e) => updateEnvValue(key, e.target.value)} />
              ) : (
                <Input
                  value={value}
                  onChange={(e) => updateEnvValue(key, e.target.value)}
                  className="font-mono"
                />
              )}
            </div>
          ))}

          {data && (
            <div className="pt-4 text-xs text-muted-foreground border-t">
              <p>Path: {data.path}</p>
              <p>Last modified: {new Date(data.mtime).toLocaleString()}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" /> Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" /> Save
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-muted-foreground">
          No environment variables configured for this profile.
        </div>
      )}

      <ConfirmDialog
        open={conflictDialog}
        title="File Modified Externally"
        description="This settings file was modified by another process. Overwrite with your changes or discard?"
        confirmText="Overwrite"
        variant="destructive"
        onConfirm={() => handleConflictResolve(true)}
        onCancel={() => handleConflictResolve(false)}
      />
    </>
  );
}

export function SettingsDialog({ open, onClose, profileName }: SettingsDialogProps) {
  // Handle dialog open/close state changes
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* Key prop ensures fresh state on each open */}
        {open && profileName && (
          <SettingsDialogContent
            key={`${profileName}-${open}`}
            profileName={profileName}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
