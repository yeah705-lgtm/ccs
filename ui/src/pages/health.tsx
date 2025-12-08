import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Monitor,
  Settings,
  Users,
  Shield,
  Zap,
  Stethoscope,
  Copy,
  Terminal,
} from 'lucide-react';
import { HealthCheckItem } from '@/components/health-check-item';
import { useHealth, type HealthGroup } from '@/hooks/use-health';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const groupIcons: Record<string, typeof Monitor> = {
  Monitor,
  Settings,
  Users,
  Shield,
  Zap,
};

const statusConfig = {
  ok: {
    icon: CheckCircle2,
    label: 'All Systems Operational',
    color: 'text-green-600',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Some Issues Detected',
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
  },
  error: {
    icon: XCircle,
    label: 'Action Required',
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
};

function getOverallStatus(summary: { passed: number; warnings: number; errors: number }) {
  if (summary.errors > 0) return 'error';
  if (summary.warnings > 0) return 'warning';
  return 'ok';
}

function HealthGroupSection({ group }: { group: HealthGroup }) {
  const Icon = groupIcons[group.icon] || Monitor;

  const groupPassed = group.checks.filter((c) => c.status === 'ok').length;
  const groupTotal = group.checks.length;
  const hasIssues = group.checks.some((c) => c.status === 'error' || c.status === 'warning');

  return (
    <Card className={cn('transition-all duration-200', hasIssues && 'border-yellow-500/30')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div
              className={cn(
                'p-1.5 rounded-md',
                hasIssues ? 'bg-yellow-500/10 text-yellow-500' : 'bg-muted text-muted-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
            </div>
            {group.name}
          </CardTitle>
          <Badge variant="secondary" className="font-mono text-xs">
            {groupPassed}/{groupTotal}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {group.checks.map((check) => (
            <HealthCheckItem key={check.id} check={check} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof CheckCircle2;
  color: string;
}) {
  return (
    <Card className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-200">
      <CardContent className="p-0">
        <div className="flex items-center gap-4 p-4 bg-card">
          <div
            className={cn(
              'p-3 rounded-xl bg-background shadow-sm border',
              color
                .replace('text-', 'text-opacity-80 border-')
                .replace('600', '200')
                .replace('500', '200')
            )}
          >
            <Icon className={cn('w-6 h-6', color)} />
          </div>
          <div>
            <p className={cn('text-3xl font-bold font-mono tracking-tight', color)}>{value}</p>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Hero Skeleton */}
      <div className="rounded-xl border p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-7 w-[240px] mb-2" />
            <Skeleton className="h-4 w-[180px]" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Summary Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>

      {/* Groups Skeleton */}
      <div className="columns-1 md:columns-2 gap-4 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="break-inside-avoid">
            <Card>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[1, 2, 3].map((j) => (
                    <Skeleton key={j} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HealthPage() {
  const { data, isLoading, refetch, dataUpdatedAt } = useHealth();

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const copyDoctorCommand = () => {
    navigator.clipboard.writeText('ccs doctor');
    toast.success('Copied to clipboard');
  };

  if (isLoading && !data) {
    return <LoadingSkeleton />;
  }

  const overallStatus = data ? getOverallStatus(data.summary) : 'ok';
  const status = statusConfig[overallStatus];
  const StatusIcon = status.icon;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Hero Section */}
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border p-6',
          'bg-gradient-to-br from-background via-background to-muted/30'
        )}
      >
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }}
          />
        </div>

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Left: Title and Status */}
          <div className="flex items-center gap-4">
            <div className={cn('p-3 rounded-xl', status.bg)}>
              <Stethoscope className={cn('w-8 h-8', status.color)} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">Health Check</h1>
                {data?.version && (
                  <Badge variant="outline" className="font-mono text-xs">
                    v{data.version}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <StatusIcon className={cn('w-4 h-4', status.color)} />
                <span className={cn('text-sm font-medium', status.color)}>{status.label}</span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyDoctorCommand}
              className="gap-2 text-muted-foreground"
            >
              <Terminal className="w-4 h-4" />
              ccs doctor
              <Copy className="w-3 h-3" />
            </Button>
            <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Last check time */}
        {dataUpdatedAt && (
          <p className="relative text-xs text-muted-foreground mt-4">
            Last check: {formatTime(dataUpdatedAt)}
          </p>
        )}
      </div>

      {/* Summary Stats */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Passed"
            value={data.summary.passed}
            icon={CheckCircle2}
            color="text-green-600"
          />
          <SummaryCard
            label="Warnings"
            value={data.summary.warnings}
            icon={AlertTriangle}
            color="text-yellow-500"
          />
          <SummaryCard
            label="Errors"
            value={data.summary.errors}
            icon={XCircle}
            color="text-red-500"
          />
          <SummaryCard label="Info" value={data.summary.info} icon={Info} color="text-blue-500" />
        </div>
      )}

      {/* Health Check Groups */}
      {data?.groups && (
        <div className="columns-1 md:columns-2 gap-4 space-y-4">
          {data.groups.map((group) => (
            <div key={group.id} className="break-inside-avoid">
              <HealthGroupSection group={group} />
            </div>
          ))}
        </div>
      )}

      {/* Issues Summary */}
      {data && (data.summary.errors > 0 || data.summary.warnings > 0) && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="w-4 h-4" />
              Issues Detected
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {data.checks
                .filter((c) => c.status === 'error' || c.status === 'warning')
                .map((check) => (
                  <div
                    key={check.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-background border"
                  >
                    {check.status === 'error' ? (
                      <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{check.name}</p>
                      <p className="text-xs text-muted-foreground">{check.message}</p>
                      {check.fix && (
                        <code className="mt-1 block text-xs bg-muted px-2 py-1 rounded font-mono text-muted-foreground">
                          {check.fix}
                        </code>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
