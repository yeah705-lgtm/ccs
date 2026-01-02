/**
 * Router Profile Card - Display profile summary in list
 * Shows tier configuration status with provider info
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Route, CheckCircle2, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { RouterProfileSummary } from '@/lib/router-types';

interface RouterProfileCardProps {
  profile: RouterProfileSummary;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

// Check if a tier is configured (has provider set)
function isTierConfigured(provider: string | undefined): boolean {
  return !!provider && provider.trim() !== '';
}

export function RouterProfileCard({
  profile,
  isActive,
  onClick,
  onDelete,
}: RouterProfileCardProps) {
  const tierConfigs = profile.tierConfigs;

  // Count configured tiers
  const configuredCount = tierConfigs
    ? [tierConfigs.opus, tierConfigs.sonnet, tierConfigs.haiku].filter((t) =>
        isTierConfigured(t?.provider)
      ).length
    : 0;

  const isFullyConfigured = configuredCount === 3;
  const isPartiallyConfigured = configuredCount > 0 && configuredCount < 3;

  // Get status for each tier
  const getTierStatus = (tier: 'opus' | 'sonnet' | 'haiku') => {
    const config = tierConfigs?.[tier];
    if (!config || !isTierConfigured(config.provider)) {
      return { configured: false, provider: '', model: '' };
    }
    return { configured: true, provider: config.provider, model: config.model };
  };

  const opusStatus = getTierStatus('opus');
  const sonnetStatus = getTierStatus('sonnet');
  const haikuStatus = getTierStatus('haiku');

  return (
    <Card
      className={`cursor-pointer transition-colors hover:bg-muted/50 group ${
        isActive ? 'border-primary bg-muted/30' : ''
      } ${isPartiallyConfigured ? 'border-dashed border-yellow-500/50' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Route className="w-4 h-4 text-muted-foreground shrink-0" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-medium text-sm truncate">{profile.name}</span>
              </TooltipTrigger>
              {profile.name.length > 20 && (
                <TooltipContent side="top">
                  <p className="font-mono text-xs">{profile.name}</p>
                </TooltipContent>
              )}
            </Tooltip>
            {isFullyConfigured ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        </div>

        {/* Tier status - compact 3-column layout */}
        <div className="grid grid-cols-3 gap-1 mt-2">
          <TierBadge label="Opus" {...opusStatus} />
          <TierBadge label="Sonnet" {...sonnetStatus} />
          <TierBadge label="Haiku" {...haikuStatus} />
        </div>

        {/* Description if present */}
        {profile.description && (
          <p className="text-xs text-muted-foreground truncate mt-2">{profile.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Compact tier badge showing configuration status */
function TierBadge({
  label,
  configured,
  provider,
}: {
  label: string;
  configured: boolean;
  provider: string;
  model: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={configured ? 'secondary' : 'outline'}
          className={`text-[10px] px-1.5 py-0.5 h-5 font-normal justify-center truncate ${
            configured ? '' : 'border-dashed text-muted-foreground'
          }`}
        >
          {configured ? provider : label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <p className="font-medium">{label} Tier</p>
        {configured ? (
          <p className="text-muted-foreground">Provider: {provider}</p>
        ) : (
          <p className="text-yellow-600">Not configured</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
