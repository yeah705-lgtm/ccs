/**
 * Model Breakdown Chart Component
 *
 * Displays usage distribution by model using pie chart.
 * Shows tokens, cost, and percentage breakdown.
 */

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { ModelUsage } from '@/hooks/use-usage';
import { cn, getModelColor } from '@/lib/utils';

interface ModelBreakdownChartProps {
  data: ModelUsage[];
  isLoading?: boolean;
  className?: string;
}

export function ModelBreakdownChart({ data, isLoading, className }: ModelBreakdownChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((item) => ({
      name: item.model,
      value: item.tokens,
      cost: item.cost,
      requests: item.requests,
      percentage: item.percentage,
      fill: getModelColor(item.model),
    }));
  }, [data]);

  if (isLoading) {
    return <Skeleton className={cn('h-[300px] w-full', className)} />;
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn('h-[300px] flex items-center justify-center', className)}>
        <p className="text-muted-foreground">No model data available</p>
      </div>
    );
  }

  const renderTooltip = ({ active, payload }: { active?: boolean; payload?: unknown }) => {
    if (!active || !payload) return null;

    const payloadArray = payload as Array<{
      payload: { name: string; value: number; cost: number; requests: number; percentage: number };
    }>;
    if (!payloadArray.length) return null;

    const data = payloadArray[0].payload;
    return (
      <div className="rounded-lg border bg-background p-2 shadow-lg text-xs">
        <p className="font-medium mb-1">{data.name}</p>
        <p className="text-muted-foreground">
          {formatNumber(data.value)} ({data.percentage.toFixed(1)}%)
        </p>
        <p className="text-muted-foreground">${data.cost.toFixed(4)}</p>
      </div>
    );
  };

  const renderLabel = (entry: { percentage: number }) => {
    return entry.percentage > 5 ? `${entry.percentage.toFixed(1)}%` : '';
  };

  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderLabel}
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={1} />
            ))}
          </Pie>
          <Tooltip content={renderTooltip} />
          {/* Legend removed from here, moved to AnalyticsPage for better layout control */}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Helper function to format large numbers
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}
