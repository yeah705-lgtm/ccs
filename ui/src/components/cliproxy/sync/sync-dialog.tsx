/**
 * Sync Dialog Component
 * Dialog for managing sync configuration, preview, and execution
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Upload, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSyncPreview, useExecuteSync } from '@/hooks/use-cliproxy-sync';

interface SyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SyncDialog({ open, onOpenChange }: SyncDialogProps) {
  const { data: preview, isLoading: previewLoading } = useSyncPreview();
  const { mutate: executeSync, isPending: isSyncing, isSuccess, reset } = useExecuteSync();

  const handleSync = () => {
    executeSync(undefined, {
      onSuccess: () => {
        // Keep dialog open to show success
      },
    });
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Sync Profiles to Local CLIProxy
          </DialogTitle>
          <DialogDescription>
            Sync your CCS API profiles to the local CLIProxy config.yaml.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {previewLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : preview?.count === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No profiles configured to sync.</p>
              <p className="text-sm mt-2">Create API profiles first using the Profiles tab.</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {preview?.profiles.map((profile) => (
                  <div
                    key={profile.name}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{profile.name}</div>
                      {profile.modelName && (
                        <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                          Model: {profile.modelName}
                        </div>
                      )}
                      {profile.baseUrl && (
                        <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                          {profile.baseUrl}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Ready
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {preview?.count ?? 0} profile{(preview?.count ?? 0) !== 1 ? 's' : ''} to sync
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSync}
                disabled={isSyncing || (preview?.count ?? 0) === 0}
                className={cn('gap-2', isSuccess && 'bg-green-600 hover:bg-green-700')}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Synced!
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
