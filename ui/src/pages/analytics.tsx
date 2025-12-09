/**
 * Analytics Page
 *
 * Displays Claude Code usage analytics with charts and tables.
 * Features daily/monthly views, trend charts, model breakdown, and session history.
 */

import { useState, useMemo } from 'react';
import type { DateRange } from 'react-day-picker';
import { startOfMonth, subDays, formatDistanceToNow } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangeFilter } from '@/components/analytics/date-range-filter';
import { UsageSummaryCards } from '@/components/analytics/usage-summary-cards';
import { UsageTrendChart } from '@/components/analytics/usage-trend-chart';
import { ModelBreakdownChart } from '@/components/analytics/model-breakdown-chart';
import { SessionsTable } from '@/components/analytics/sessions-table';
import { TrendingUp, PieChart, Clock, Calendar, RefreshCw } from 'lucide-react';
import {
  useUsageSummary,
  useUsageTrends,
  useModelUsage,
  useSessions,
  useRefreshUsage,
  useUsageStatus,
} from '@/hooks/use-usage';
import { getModelColor } from '@/lib/utils';

type ViewMode = 'daily' | 'monthly' | 'sessions';

export function AnalyticsPage() {
  // Default to last 30 days
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh hook
  const refreshUsage = useRefreshUsage();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshUsage();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Convert dates to API format
  const apiOptions = {
    startDate: dateRange?.from,
    endDate: dateRange?.to,
  };

  // Fetch data
  const { data: summary, isLoading: isSummaryLoading } = useUsageSummary(apiOptions);
  const { data: trends, isLoading: isTrendsLoading } = useUsageTrends(apiOptions);
  const { data: models, isLoading: isModelsLoading } = useModelUsage(apiOptions);
  const { data: sessions, isLoading: isSessionsLoading } = useSessions({
    ...apiOptions,
    limit: 50,
  });
  const { data: status } = useUsageStatus();

  // Format "Last updated" text
  const lastUpdatedText = useMemo(() => {
    if (!status?.lastFetch) return null;
    return formatDistanceToNow(new Date(status.lastFetch), { addSuffix: true });
  }, [status?.lastFetch]);

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 pb-14 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-semibold">Analytics</h1>
            <p className="text-sm text-muted-foreground">Track usage & insights</p>
          </div>
          <div className="flex items-center gap-2">
            <DateRangeFilter
              value={dateRange}
              onChange={setDateRange}
              presets={[
                { label: '7D', range: { from: subDays(new Date(), 7), to: new Date() } },
                { label: '30D', range: { from: subDays(new Date(), 30), to: new Date() } },
                { label: 'Month', range: { from: startOfMonth(new Date()), to: new Date() } },
              ]}
            />
            {lastUpdatedText && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Updated {lastUpdatedText}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-8"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <UsageSummaryCards data={summary} isLoading={isSummaryLoading} />

        {/* Main Content Tabs */}
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="grid w-full grid-cols-3 h-9 mb-4">
            <TabsTrigger value="daily" className="text-xs">
              Daily
            </TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs">
              Monthly
            </TabsTrigger>
            <TabsTrigger value="sessions" className="text-xs">
              Sessions
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0">
            {/* Daily View */}
            <TabsContent value="daily" className="flex flex-col gap-4 m-0 h-full overflow-hidden">
              {/* Usage Trend Chart - Full Width */}
              <Card className="flex flex-col flex-1 min-h-0 shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Usage Trends
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex-1 min-h-0 flex items-center justify-center">
                  <UsageTrendChart
                    data={trends || []}
                    isLoading={isTrendsLoading}
                    className="h-full"
                  />
                </CardContent>
              </Card>

              {/* Bottom Row - Model Usage & Cost */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
                {/* Model Distribution */}
                <Card className="flex flex-col h-full min-h-0 shadow-sm">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <PieChart className="w-4 h-4" />
                      Model Usage
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 flex-1 min-h-0 flex items-center justify-center">
                    <div className="flex w-full h-full items-center">
                      <div className="flex-1 h-full min-w-0">
                        <ModelBreakdownChart
                          data={models || []}
                          isLoading={isModelsLoading}
                          className="h-full"
                        />
                      </div>
                      <div className="w-[220px] shrink-0 pl-4 space-y-2 overflow-y-auto max-h-full">
                        {models?.slice(0, 8).map((model) => (
                          <div key={model.model} className="flex items-center gap-2 text-xs">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: getModelColor(model.model) }}
                            />
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex justify-between items-baseline gap-2">
                                <span className="font-medium truncate" title={model.model}>
                                  {model.model}
                                </span>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {model.percentage.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Cost Breakdown */}
                <Card className="flex flex-col h-full min-h-0 shadow-sm">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium">Cost by Model</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 flex-1 min-h-0 overflow-y-auto">
                    {isModelsLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : (
                      <div className="space-y-2">
                        {[...(models || [])]
                          .sort((a, b) => b.cost - a.cost)
                          .map((model) => (
                            <div
                              key={model.model}
                              className="flex items-center justify-between text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: getModelColor(model.model) }}
                                />
                                <span className="font-medium" title={model.model}>
                                  {model.model}
                                </span>
                              </div>
                              <span className="text-muted-foreground whitespace-nowrap font-mono">
                                ${model.cost.toFixed(4)}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Monthly View */}
            <TabsContent value="monthly" className="m-0 h-full">
              <Card className="h-full flex flex-col">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Monthly Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex-1">
                  <UsageTrendChart
                    data={trends || []}
                    isLoading={isTrendsLoading}
                    granularity="monthly"
                    className="h-full"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Sessions View */}
            <TabsContent value="sessions" className="m-0 h-full">
              <Card className="h-full flex flex-col">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Session History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                  <div className="h-full overflow-y-auto">
                    <SessionsTable data={sessions} isLoading={isSessionsLoading} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-4 h-full overflow-hidden">
      {/* Usage Trends Skeleton */}
      <Card className="flex flex-col min-h-[300px]">
        <CardHeader className="p-4 pb-2">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="p-4 pt-0 flex-1">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>

      {/* Bottom Row Skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Model Usage Skeleton */}
        <Card className="flex flex-col min-h-[250px]">
          <CardHeader className="p-4 pb-2">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="p-4 pt-0 flex-1">
            <div className="flex w-full h-full items-center">
              <div className="flex-1 flex justify-center">
                <Skeleton className="h-[180px] w-[180px] rounded-full" />
              </div>
              <div className="w-[140px] shrink-0 pl-2 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="w-2 h-2 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost Breakdown Skeleton */}
        <Card className="flex flex-col min-h-[250px]">
          <CardHeader className="p-4 pb-2">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-2.5 h-2.5 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
