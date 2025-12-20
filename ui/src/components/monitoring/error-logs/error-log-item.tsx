/**
 * Error Log Item Component
 * Individual log entry in the list view
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Clock, FileText } from 'lucide-react';
import { ProviderIcon } from '@/components/shared/provider-icon';
import { parseFilename, formatRelativeTime, formatBytes } from '@/lib/error-log-parser';
import type { ErrorLogItemProps } from './types';

export function ErrorLogItem({ name, size, modified, isSelected, onClick }: ErrorLogItemProps) {
  const parsed = useMemo(() => parseFilename(name), [name]);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full px-3 py-2.5 flex items-start gap-3 text-left transition-colors',
        'hover:bg-muted/40 border-l-[3px]',
        isSelected ? 'bg-muted/50 border-l-amber-500' : 'border-l-transparent'
      )}
    >
      {/* Provider Icon */}
      <ProviderIcon
        provider={parsed.provider}
        size={24}
        withBackground={true}
        className="shrink-0 mt-0.5"
      />

      <div className="flex-1 min-w-0 space-y-1">
        {/* Provider / Endpoint */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground truncate">
              {parsed.provider}
            </span>
            <span
              className={cn(
                'text-[9px] px-1 rounded border',
                isSelected
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  : 'bg-muted border-border text-muted-foreground'
              )}
            >
              LOG
            </span>
          </div>
          <span
            className="text-[11px] text-muted-foreground truncate font-medium"
            title={parsed.endpoint}
          >
            {parsed.endpoint}
          </span>
        </div>

        {/* Meta row: time + size */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/80 mt-1">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(modified)}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {formatBytes(size)}
          </span>
        </div>
      </div>
    </button>
  );
}
