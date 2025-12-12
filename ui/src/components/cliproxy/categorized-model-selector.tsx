/**
 * Categorized Model Selector
 * Groups models by provider (owned_by) with model counts
 */

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Cpu } from 'lucide-react';
import type { CliproxyModelsResponse } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/** Provider display configuration */
const CATEGORY_CONFIG: Record<string, { name: string; color: string }> = {
  google: { name: 'Google (Gemini)', color: 'text-blue-600' },
  openai: { name: 'OpenAI (GPT)', color: 'text-green-600' },
  anthropic: { name: 'Anthropic (Claude)', color: 'text-orange-600' },
  antigravity: { name: 'Antigravity', color: 'text-purple-600' },
  other: { name: 'Other', color: 'text-gray-600' },
};

/** Get display name for category */
function getCategoryDisplay(category: string) {
  return (
    CATEGORY_CONFIG[category.toLowerCase()] || {
      name: category.charAt(0).toUpperCase() + category.slice(1),
      color: 'text-gray-600',
    }
  );
}

interface CategorizedModelSelectorProps {
  /** Models data from API */
  modelsData: CliproxyModelsResponse | undefined;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Currently selected model */
  value: string | undefined;
  /** Callback when model changes */
  onChange: (model: string) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Custom width class */
  className?: string;
}

export function CategorizedModelSelector({
  modelsData,
  isLoading,
  value,
  onChange,
  disabled,
  placeholder = 'Select a model',
  className,
}: CategorizedModelSelectorProps) {
  // Sort categories by model count (descending)
  const sortedCategories = useMemo(() => {
    if (!modelsData?.byCategory) return [];
    return Object.entries(modelsData.byCategory)
      .sort(([, a], [, b]) => b.length - a.length)
      .map(([category, models]) => ({
        category,
        display: getCategoryDisplay(category),
        models,
      }));
  }, [modelsData]);

  if (isLoading) {
    return <Skeleton className={cn('h-9 w-[280px]', className)} />;
  }

  if (!modelsData || modelsData.totalCount === 0) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <Cpu className="w-4 h-4" />
        <span>No models available</span>
      </div>
    );
  }

  return (
    <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn('w-[320px]', className)}>
        <SelectValue placeholder={placeholder}>
          {value && (
            <div className="flex items-center gap-2">
              <span className="truncate">{value}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[400px]">
        {sortedCategories.map(({ category, display, models }) => (
          <SelectGroup key={category}>
            <SelectLabel className="flex items-center justify-between px-2 py-1.5">
              <span className={cn('font-semibold', display.color)}>{display.name}</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-2">
                {models.length}
              </Badge>
            </SelectLabel>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id} className="pl-4">
                <span className="truncate">{model.id}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Compact variant for inline usage */
export function CategorizedModelSelectorCompact({
  modelsData,
  isLoading,
  value,
  onChange,
  disabled,
}: Omit<CategorizedModelSelectorProps, 'placeholder' | 'className'>) {
  return (
    <CategorizedModelSelector
      modelsData={modelsData}
      isLoading={isLoading}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder="Model..."
      className="w-[200px]"
    />
  );
}
