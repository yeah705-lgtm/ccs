/**
 * Usage Trend Chart Component
 *
 * Displays usage trends over time with tokens and cost.
 * Supports daily and monthly granularity with interactive tooltips.
 */

import { useMemo } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import type { DailyUsage } from '@/hooks/use-usage';

interface UsageTrendChartProps {
  data: DailyUsage[];
  isLoading?: boolean;
  dateRange?: DateRange;
  granularity?: 'daily' | 'monthly';
  className?: string;
}

export function UsageTrendChart({
  data,
  isLoading,
  granularity = 'daily',
  className,
}: Omit<UsageTrendChartProps, 'dateRange'>) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return [...data].reverse().map((item) => ({
      ...item,
      dateFormatted: formatDate(item.date, granularity),
      costRounded: Number(item.cost.toFixed(4)),
    }));
  }, [data, granularity]);

  if (isLoading) {
    return <Skeleton className={cn('h-full w-full', className)} />;
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn('h-full flex items-center justify-center', className)}>
        <p className="text-muted-foreground">No usage data available</p>
      </div>
    );
  }

  return (
    <div className={cn('w-full h-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0080FF" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#0080FF" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00C49F" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#00C49F" stopOpacity={0.1} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

          <XAxis
            dataKey="dateFormatted"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ className: 'stroke-muted' }}
          />

          <YAxis
            yAxisId="left"
            orientation="left"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ className: 'stroke-muted' }}
            tickFormatter={(value) => formatNumber(value)}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ className: 'stroke-muted' }}
            tickFormatter={(value) => `$${value}`}
          />

          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;

              const data = payload[0].payload;
              return (
                <div className="rounded-lg border bg-background p-3 shadow-lg">
                  <p className="font-medium mb-2">{label}</p>
                  {payload.map((entry, index) => (
                    <p key={index} className="text-sm" style={{ color: entry.color }}>
                      {entry.name}:{' '}
                      {entry.name === 'Tokens'
                        ? formatNumber(Number(entry.value) || 0)
                        : `$${entry.value}`}
                    </p>
                  ))}
                  <p className="text-sm text-muted-foreground mt-1">Requests: {data.requests}</p>
                </div>
              );
            }}
          />

          <Area
            yAxisId="left"
            type="monotone"
            dataKey="tokens"
            stroke="#0080FF"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#tokenGradient)"
            name="Tokens"
          />

          <Area
            yAxisId="right"
            type="monotone"
            dataKey="costRounded"
            stroke="#00C49F"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#costGradient)"
            name="Cost"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Helper functions
function formatDate(dateStr: string, granularity: 'daily' | 'monthly'): string {
  const date = new Date(dateStr);

  if (granularity === 'monthly') {
    return format(date, 'MMM yyyy');
  }

  // For daily, show shorter format if range is > 30 days
  return format(date, 'MMM dd');
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}
