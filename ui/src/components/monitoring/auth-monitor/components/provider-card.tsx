/**
 * ProviderCard - Provider status card with expandable account controls
 * Click to expand and show individual account toggle/solo buttons
 */

import type React from 'react';
import { useState } from 'react';
import { ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { cn, STATUS_COLORS } from '@/lib/utils';
import { PROVIDER_COLORS } from '@/lib/provider-config';
import { ProviderIcon } from '@/components/shared/provider-icon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ProviderStats } from '../types';
import { getSuccessRate, cleanEmail } from '../utils';
import { InlineStatsBadge } from './inline-stats-badge';
import { ExpandableAccountList } from './expandable-account-list';

interface ProviderCardProps {
  stats: ProviderStats;
  isHovered: boolean;
  privacyMode: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onPauseToggle?: (accountId: string, paused: boolean) => void;
  onSoloMode?: (accountId: string) => void;
  isPausingAccount?: boolean;
  isSoloingAccount?: boolean;
}

export function ProviderCard({
  stats,
  isHovered,
  privacyMode,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  onPauseToggle,
  onSoloMode,
  isPausingAccount,
  isSoloingAccount,
}: ProviderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const successRate = getSuccessRate(stats.successCount, stats.failureCount);
  const providerColor = PROVIDER_COLORS[stats.provider.toLowerCase()] || '#6b7280';

  // Only expandable if account control callbacks are provided
  const isExpandable = !!(onPauseToggle && onSoloMode);

  const handleClick = () => {
    if (isExpandable) {
      setIsExpanded(!isExpanded);
    } else {
      onSelect();
    }
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-expanded={isExpandable ? isExpanded : undefined}
      className={cn(
        'group relative rounded-xl p-4 text-left transition-all duration-300',
        'bg-muted/30 dark:bg-zinc-900/60 backdrop-blur-sm',
        'border border-border/50 dark:border-white/[0.08]',
        'hover:border-opacity-50 hover:scale-[1.02] hover:shadow-lg',
        isHovered && 'ring-1'
      )}
      style={
        {
          borderColor: isHovered ? providerColor : undefined,
          '--ring-color': providerColor,
        } as React.CSSProperties
      }
    >
      <div className="flex items-center gap-3 mb-3">
        <ProviderIcon provider={stats.provider} size={36} withBackground />
        <div>
          <h3 className="text-sm font-semibold text-foreground tracking-tight">
            {stats.displayName}
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {stats.accountCount} account{stats.accountCount !== 1 ? 's' : ''}
          </p>
        </div>
        {isExpandable ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground" />
          ) : (
            <ChevronRight
              className={cn(
                'w-4 h-4 ml-auto text-muted-foreground transition-all',
                isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
              )}
            />
          )
        ) : (
          <ChevronRight
            className={cn(
              'w-4 h-4 ml-auto text-muted-foreground transition-all',
              isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
            )}
          />
        )}
      </div>

      <div className="space-y-2">
        {/* Inline success/failure stats - immediately visible */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Stats</span>
          <InlineStatsBadge success={stats.successCount} failure={stats.failureCount} />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Success Rate</span>
          <span
            className="font-mono font-semibold"
            style={{
              color:
                successRate === 100
                  ? STATUS_COLORS.success
                  : successRate >= 95
                    ? STATUS_COLORS.degraded
                    : STATUS_COLORS.failed,
            }}
          >
            {successRate}%
          </span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-muted dark:bg-zinc-800/50 h-1 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${successRate}%`,
              backgroundColor: providerColor,
            }}
          />
        </div>
      </div>

      {/* Account color dots with warning for agy accounts missing projectId */}
      {!isExpanded && (
        <div className="flex gap-1 mt-3 items-center">
          {stats.accounts.slice(0, 5).map((acc) => {
            const isMissingProjectId = stats.provider === 'agy' && !acc.projectId;
            return (
              <div key={acc.id} className="relative">
                <div
                  className={cn('w-2 h-2 rounded-full', acc.paused && 'opacity-50')}
                  style={{ backgroundColor: acc.color }}
                  title={privacyMode ? '••••••' : cleanEmail(acc.email)}
                />
                {isMissingProjectId && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle
                          className="absolute -top-1 -right-1 w-2.5 h-2.5 text-amber-500"
                          aria-label="Missing Project ID"
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Missing Project ID - re-add account to fix
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            );
          })}
          {stats.accounts.length > 5 && (
            <span className="text-[10px] text-muted-foreground ml-1">
              +{stats.accounts.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Expandable account list */}
      {isExpandable && (
        <div
          className={cn(
            'overflow-hidden transition-all duration-200',
            isExpanded ? 'max-h-96' : 'max-h-0'
          )}
        >
          <ExpandableAccountList
            accounts={stats.accounts}
            privacyMode={privacyMode}
            onPauseToggle={onPauseToggle}
            onSoloMode={onSoloMode}
            isPausingAccount={isPausingAccount}
            isSoloingAccount={isSoloingAccount}
          />
        </div>
      )}
    </button>
  );
}
