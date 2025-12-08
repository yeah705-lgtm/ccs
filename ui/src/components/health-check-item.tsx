import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Wrench,
  ChevronDown,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useFixHealth, type HealthCheck } from '@/hooks/use-health';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const statusConfig = {
  ok: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-500/5',
    border: 'border-green-500/20',
    label: '[OK]',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/5',
    border: 'border-yellow-500/20',
    label: '[!]',
  },
  error: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-500/5',
    border: 'border-red-500/20',
    label: '[X]',
  },
  info: {
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    label: '[i]',
  },
};

export function HealthCheckItem({ check }: { check: HealthCheck }) {
  const fixMutation = useFixHealth();
  const config = statusConfig[check.status];
  const Icon = config.icon;
  const [isOpen, setIsOpen] = useState(false);

  const hasExpandableContent = check.details || check.fix;

  if (!hasExpandableContent) {
    return (
      <div
        className={cn(
          'group flex items-start gap-4 p-4 rounded-xl border transition-all duration-200',
          'hover:shadow-sm',
          config.bg,
          config.border
        )}
      >
        <div
          className={cn(
            'mt-0.5 p-2 rounded-full bg-background/50 backdrop-blur-sm shadow-sm',
            config.color
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-center justify-between gap-4 mb-1">
            <h4 className="text-base font-semibold tracking-tight">{check.name}</h4>
            <span
              className={cn(
                'text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-background/50',
                config.color
              )}
            >
              {config.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{check.message}</p>
        </div>
        {check.fixable && check.status !== 'ok' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => fixMutation.mutate(check.id)}
            disabled={fixMutation.isPending}
            className="h-9 px-4 ml-2 self-center bg-background shadow-sm hover:bg-background/80"
          >
            <Wrench className="w-3.5 h-3.5 mr-2" />
            Fix Issue
          </Button>
        )}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          'group rounded-xl border transition-all duration-200 hover:shadow-sm',
          config.bg,
          config.border
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'w-full flex items-start gap-4 p-4 text-left rounded-xl transition-all',
              isOpen && 'rounded-b-none border-b border-border/10'
            )}
          >
            <div
              className={cn(
                'mt-0.5 p-2 rounded-full bg-background/50 backdrop-blur-sm shadow-sm',
                config.color
              )}
            >
              <Icon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0 py-0.5">
              <div className="flex items-center justify-between gap-4 mb-1">
                <h4 className="text-base font-semibold tracking-tight">{check.name}</h4>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-background/50',
                      config.color
                    )}
                  >
                    {config.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      'w-5 h-5 text-muted-foreground/70 transition-transform duration-200',
                      isOpen && 'rotate-180'
                    )}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{check.message}</p>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 pt-2 space-y-3">
            {check.details && (
              <div className="bg-background/50 rounded-lg p-3 border border-border/10">
                <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
                  {check.details}
                </p>
              </div>
            )}

            {check.fix && (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 bg-background/50 rounded-lg p-3 border border-border/10 flex items-center gap-3">
                  <Terminal className="w-4 h-4 text-muted-foreground shrink-0" />
                  <code className="text-xs font-mono text-foreground break-all">{check.fix}</code>
                </div>

                {check.fixable && check.status !== 'ok' && (
                  <Button
                    size="sm"
                    onClick={() => fixMutation.mutate(check.id)}
                    disabled={fixMutation.isPending}
                    className="h-auto py-3 px-6 shadow-sm shrink-0"
                  >
                    <Wrench className="w-4 h-4 mr-2" />
                    Apply Fix
                  </Button>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
