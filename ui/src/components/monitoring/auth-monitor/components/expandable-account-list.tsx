/**
 * Expandable Account List - Account rows with toggle and solo controls
 * Used in ProviderCard when expanded to show individual account controls
 */

import { Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { cleanEmail } from '../utils';
import type { AccountRow } from '../types';

interface ExpandableAccountListProps {
  accounts: AccountRow[];
  privacyMode: boolean;
  onPauseToggle: (accountId: string, paused: boolean) => void;
  onSoloMode: (accountId: string) => void;
  isPausingAccount?: boolean;
  isSoloingAccount?: boolean;
}

export function ExpandableAccountList({
  accounts,
  privacyMode,
  onPauseToggle,
  onSoloMode,
  isPausingAccount,
  isSoloingAccount,
}: ExpandableAccountListProps) {
  return (
    <div className="space-y-1 pt-3 border-t border-border/50">
      {accounts.map((acc) => (
        <div
          key={acc.id}
          className={cn(
            'flex items-center justify-between py-1.5 px-2 rounded',
            acc.paused && 'opacity-50'
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
            <span className="text-xs truncate max-w-[140px]" title={acc.email}>
              {privacyMode ? '••••••' : cleanEmail(acc.email)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSoloMode(acc.id);
                    }}
                    disabled={isSoloingAccount || acc.paused}
                  >
                    <Radio className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Solo mode - activate this, pause others
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Switch
              checked={!acc.paused}
              onCheckedChange={(checked) => {
                onPauseToggle(acc.id, !checked);
              }}
              disabled={isPausingAccount}
              className="scale-75"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
