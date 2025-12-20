/**
 * Log Content Panel Component
 * Detail view with tabbed navigation for error log content
 */

import { useState, useMemo } from 'react';
import { useCliproxyErrorLogContent } from '@/hooks/use-cliproxy-stats';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyButton } from '@/components/ui/copy-button';
import { Terminal, Info, Code, ArrowUpRight, ArrowDownLeft, FileText } from 'lucide-react';
import { parseErrorLog } from '@/lib/error-log-parser';
import type { TabType, LogContentPanelProps } from './types';
import { TabButton, StatusBadge } from './ui-primitives';
import { OverviewTab, HeadersTab, BodyTab, RawTab } from './tab-components';

export function LogContentPanel({ name, absolutePath }: LogContentPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const { data: content, isLoading, error } = useCliproxyErrorLogContent(name);

  // Parse log content
  const parsed = useMemo(() => {
    if (!content) return null;
    return parseErrorLog(content);
  }, [content]);

  // No log selected
  if (!name) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-3">
          <Terminal className="w-10 h-10 mx-auto opacity-40" />
          <p className="text-sm">Select a log to view details</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    );
  }

  // Error or no content
  if (error || !content || !parsed) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p className="text-sm">Failed to load log content</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Header with status */}
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <StatusBadge code={parsed.statusCode} />
          <span className="text-xs font-semibold truncate text-foreground">
            {parsed.provider}/{parsed.endpoint || 'unknown'}
          </span>
          {/* Copy Absolute Path Button */}
          {name && (
            <CopyButton
              value={absolutePath || name}
              label="Copy absolute path"
              size="icon-sm"
              className="ml-1 text-muted-foreground hover:text-foreground opacity-50 hover:opacity-100 transition-opacity"
            />
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Copy Raw Content Button */}
          {content && (
            <CopyButton
              value={content}
              label="Copy raw log content"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
            />
          )}
          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded border border-border/50">
            {parsed.method}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-1 bg-muted/10 shrink-0 overflow-x-auto">
        <TabButton
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          icon={Info}
        >
          Overview
        </TabButton>
        <TabButton
          active={activeTab === 'headers'}
          onClick={() => setActiveTab('headers')}
          icon={Code}
        >
          Headers
        </TabButton>
        <TabButton
          active={activeTab === 'request'}
          onClick={() => setActiveTab('request')}
          icon={ArrowUpRight}
        >
          Request
        </TabButton>
        <TabButton
          active={activeTab === 'response'}
          onClick={() => setActiveTab('response')}
          icon={ArrowDownLeft}
        >
          Response
        </TabButton>
        <TabButton active={activeTab === 'raw'} onClick={() => setActiveTab('raw')} icon={FileText}>
          Raw
        </TabButton>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden bg-card/30">
        {activeTab === 'overview' && <OverviewTab parsed={parsed} />}
        {activeTab === 'headers' && <HeadersTab headers={parsed.requestHeaders} />}
        {activeTab === 'request' && <BodyTab content={parsed.requestBody} label="Request" />}
        {activeTab === 'response' && <BodyTab content={parsed.responseBody} label="Response" />}
        {activeTab === 'raw' && <RawTab content={content} />}
      </div>
    </div>
  );
}
