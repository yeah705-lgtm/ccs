/**
 * Provider Model Selector Component
 * Per-provider model selection using model-catalog.ts
 * Includes tier badges, broken/deprecated status indicators
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
import { AlertTriangle, AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Model entry from catalog */
export interface ModelEntry {
  id: string;
  name: string;
  tier?: 'free' | 'paid';
  description?: string;
  broken?: boolean;
  issueUrl?: string;
  deprecated?: boolean;
  deprecationReason?: string;
  /** Optional preset mapping for different tiers (if different from id) */
  presetMapping?: {
    default: string;
    opus: string;
    sonnet: string;
    haiku: string;
  };
}

/** Provider catalog */
export interface ProviderCatalog {
  provider: string;
  displayName: string;
  models: ModelEntry[];
  defaultModel: string;
}

interface ProviderModelSelectorProps {
  /** Provider catalog data */
  catalog: ProviderCatalog | undefined;
  /** Loading state */
  isLoading?: boolean;
  /** Currently selected model */
  value: string | undefined;
  /** Callback when model changes */
  onChange: (model: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Custom className */
  className?: string;
}

export function ProviderModelSelector({
  catalog,
  isLoading,
  value,
  onChange,
  disabled,
  placeholder = 'Select a model',
  className,
}: ProviderModelSelectorProps) {
  // Group models by tier
  const groupedModels = useMemo(() => {
    if (!catalog?.models) return { free: [], paid: [] };
    return {
      free: catalog.models.filter((m) => !m.tier || m.tier === 'free'),
      paid: catalog.models.filter((m) => m.tier === 'paid'),
    };
  }, [catalog]);

  const selectedModel = useMemo(() => {
    return catalog?.models.find((m) => m.id === value);
  }, [catalog, value]);

  if (isLoading) {
    return <Skeleton className={cn('h-9 w-full', className)} />;
  }

  if (!catalog || catalog.models.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground py-2', className)}>
        No models available for this provider
      </div>
    );
  }

  const renderModelItem = (model: ModelEntry) => (
    <SelectItem
      key={model.id}
      value={model.id}
      className={cn('pl-4', model.broken && 'opacity-60', model.deprecated && 'opacity-60')}
    >
      <div className="flex items-center gap-2">
        <span className="truncate">{model.name}</span>
        {model.broken && (
          <Badge variant="destructive" className="text-[9px] h-4 px-1">
            BROKEN
          </Badge>
        )}
        {model.deprecated && (
          <Badge variant="secondary" className="text-[9px] h-4 px-1">
            DEPRECATED
          </Badge>
        )}
        {value === model.id && <Check className="w-3 h-3 text-primary ml-auto" />}
      </div>
    </SelectItem>
  );

  return (
    <div className={cn('space-y-2', className)}>
      <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>
            {selectedModel && (
              <div className="flex items-center gap-2">
                <span className="truncate">{selectedModel.name}</span>
                {selectedModel.tier === 'paid' && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1">
                    PAID
                  </Badge>
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {groupedModels.free.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-xs text-muted-foreground">Free Tier</SelectLabel>
              {groupedModels.free.map(renderModelItem)}
            </SelectGroup>
          )}
          {groupedModels.paid.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-xs text-amber-600">Paid Tier</SelectLabel>
              {groupedModels.paid.map(renderModelItem)}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      {/* Warning for broken/deprecated models */}
      {selectedModel?.broken && (
        <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-md text-xs text-destructive">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">This model has known issues</p>
            {selectedModel.issueUrl && (
              <a
                href={selectedModel.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                View issue details
              </a>
            )}
          </div>
        </div>
      )}

      {selectedModel?.deprecated && (
        <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded-md text-xs text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">This model is deprecated</p>
            {selectedModel.deprecationReason && (
              <p className="opacity-80">{selectedModel.deprecationReason}</p>
            )}
          </div>
        </div>
      )}

      {/* Model description */}
      {selectedModel?.description && !selectedModel.broken && !selectedModel.deprecated && (
        <p className="text-xs text-muted-foreground">{selectedModel.description}</p>
      )}
    </div>
  );
}

/** Model Mapping Selector - For Opus/Sonnet/Haiku mapping */
interface ModelMappingSelectorProps {
  catalog: ProviderCatalog | undefined;
  label: string;
  value: string | undefined;
  onChange: (model: string) => void;
  disabled?: boolean;
}

export function ModelMappingSelector({
  catalog,
  label,
  value,
  onChange,
  disabled,
}: ModelMappingSelectorProps) {
  if (!catalog) return null;

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select model">
            {value && <span className="truncate font-mono text-xs">{value}</span>}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {catalog.models.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              <div className="flex items-center gap-2">
                <span className="truncate text-sm">{model.name}</span>
                {model.tier === 'paid' && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1">
                    PAID
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Flexible Model Selector - Combines catalog recommendations with full model list */
interface FlexibleModelSelectorProps {
  label: string;
  description?: string;
  value: string | undefined;
  onChange: (model: string) => void;
  catalog?: ProviderCatalog;
  allModels: { id: string; owned_by: string }[];
  disabled?: boolean;
}

export function FlexibleModelSelector({
  label,
  description,
  value,
  onChange,
  catalog,
  allModels,
  disabled,
}: FlexibleModelSelectorProps) {
  // Combine catalog models (recommended) with all available models
  const catalogModelIds = new Set(catalog?.models.map((m) => m.id) || []);

  return (
    <div className="space-y-1.5">
      <div>
        <label className="text-xs font-medium">{label}</label>
        {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
      </div>
      <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Select model">
            {value && <span className="truncate font-mono text-xs">{value}</span>}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {/* Recommended models from catalog */}
          {catalog && catalog.models.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-xs text-primary">Recommended</SelectLabel>
              {catalog.models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-xs">{model.id}</span>
                    {model.tier === 'paid' && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1">
                        PAID
                      </Badge>
                    )}
                    {value === model.id && <Check className="w-3 h-3 text-primary ml-auto" />}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}

          {/* All available models (excluding already shown) */}
          {allModels.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-xs text-muted-foreground">
                All Models ({allModels.length})
              </SelectLabel>
              {allModels
                .filter((m) => !catalogModelIds.has(m.id))
                .map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-xs">{model.id}</span>
                      {value === model.id && <Check className="w-3 h-3 text-primary ml-auto" />}
                    </div>
                  </SelectItem>
                ))}
            </SelectGroup>
          )}

          {/* Fallback if no models available */}
          {(!catalog || catalog.models.length === 0) && allModels.length === 0 && (
            <div className="py-2 px-3 text-xs text-muted-foreground">No models available</div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
