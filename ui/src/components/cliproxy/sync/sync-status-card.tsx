/**
 * Sync Status Card Component
 * Shows local CLIProxy config sync status and controls
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, FileDown, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SyncDialog } from './sync-dialog';
import { useSyncStatus, useExecuteSync } from '@/hooks/use-cliproxy-sync';

export function SyncStatusCard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: status, isLoading, refetch } = useSyncStatus();
  const { mutate: executeSync, isPending: isSyncing } = useExecuteSync();

  const handleQuickSync = () => {
    executeSync(undefined, {
      onSuccess: () => {
        refetch();
      },
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileDown className="w-4 h-4" />
            Profile Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isConfigured = status?.configured ?? false;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileDown className="w-4 h-4" />
              Profile Sync
            </CardTitle>
            <Badge
              variant={isConfigured ? 'default' : 'secondary'}
              className={cn(
                'gap-1.5',
                isConfigured
                  ? 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {isConfigured ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              {isConfigured ? 'Ready' : 'No Config'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConfigured && (
            <div className="text-xs text-muted-foreground">
              Syncs API profiles to local CLIProxy config
            </div>
          )}

          {!isConfigured && (
            <p className="text-xs text-muted-foreground">
              Run <code className="bg-muted px-1 rounded">ccs doctor --fix</code> to generate
              config.
            </p>
          )}

          {status?.error && <p className="text-xs text-red-500">{status.error}</p>}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setDialogOpen(true)}
            >
              Aliases
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1 gap-2"
              onClick={handleQuickSync}
              disabled={!isConfigured || isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Sync Now
            </Button>
          </div>
        </CardContent>
      </Card>

      <SyncDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
