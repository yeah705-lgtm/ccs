/**
 * Add Account Dialog Component
 * Simple dialog to add another OAuth account to a provider
 *
 * Shows auth command + refresh button (no variant creation)
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, Check, RefreshCw, Terminal } from 'lucide-react';
import { useCliproxyAuth } from '@/hooks/use-cliproxy';

interface AddAccountDialogProps {
  open: boolean;
  onClose: () => void;
  provider: string;
  displayName: string;
}

export function AddAccountDialog({ open, onClose, provider, displayName }: AddAccountDialogProps) {
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { refetch } = useCliproxyAuth();

  const authCommand = `ccs ${provider} --auth --add`;

  const copyCommand = async () => {
    await navigator.clipboard.writeText(authCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add {displayName} Account</DialogTitle>
          <DialogDescription>
            Run the command below in your terminal to authenticate a new account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Terminal className="w-4 h-4" />
                Run this command:
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm">
                  {authCommand}
                </code>
                <Button variant="outline" size="icon" onClick={copyCommand}>
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                This will open your browser to authenticate with {displayName}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Checking...' : 'I ran the command'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
