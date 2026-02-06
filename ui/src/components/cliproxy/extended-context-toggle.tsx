/**
 * Extended Context Toggle Component
 * Shows toggle for models that support 1M token context window.
 * Only visible when selected model has extendedContext: true.
 */

import { Zap, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ModelEntry } from './provider-model-selector';

interface ExtendedContextToggleProps {
  /** Currently selected model */
  model: ModelEntry | undefined;
  /** Provider name for display */
  provider: string;
  /** Whether extended context is enabled */
  enabled: boolean;
  /** Callback when toggle changes */
  onToggle: (enabled: boolean) => void;
  /** Whether the toggle is disabled (saving state) */
  disabled?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Check if model is a native Gemini model (auto-enabled behavior).
 * Native Gemini models: gemini-* but NOT gemini-claude-*
 */
function isNativeGeminiModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return lower.startsWith('gemini-') && !lower.startsWith('gemini-claude-');
}

export function ExtendedContextToggle({
  model,
  provider,
  enabled,
  onToggle,
  disabled,
  className,
}: ExtendedContextToggleProps) {
  // Only show if model supports extended context
  if (!model?.extendedContext) {
    return null;
  }

  const isAutoEnabled = isNativeGeminiModel(model.id);

  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2',
        enabled ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/30',
        className
      )}
    >
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className={cn('w-4 h-4', enabled ? 'text-primary' : 'text-muted-foreground')} />
          <span className="text-sm font-medium">Extended Context</span>
          <Badge variant={enabled ? 'default' : 'secondary'} className="text-[10px] h-5 px-1.5">
            1M tokens
          </Badge>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} disabled={disabled} />
      </div>

      {/* Info text */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p>Enables 1M token context window instead of default 200K.</p>
          <p className="text-[10px]">
            {isAutoEnabled ? (
              <span className="text-primary">Auto-enabled for {provider} Gemini models</span>
            ) : (
              <span>Opt-in for {provider} Claude models via --1m flag</span>
            )}
          </p>
          {enabled && (
            <p className="text-amber-600 dark:text-amber-500">
              Note: 2x input pricing applies for tokens beyond 200K
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
