/**
 * Router Provider Picker - Select provider + model with health status
 * Shows dropdown for both provider and model selection
 */

import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { RouterProvider } from '@/lib/router-types';
import { MODEL_CATALOGS } from '@/lib/model-catalogs';

interface RouterProviderPickerProps {
  providers: RouterProvider[];
  value: { provider: string; model: string };
  onChange: (value: { provider: string; model: string }) => void;
}

export function RouterProviderPicker({ providers, value, onChange }: RouterProviderPickerProps) {
  const selectedProvider = useMemo(
    () => providers.find((p) => p.name === value.provider),
    [providers, value.provider]
  );

  // Get models for selected provider from catalog
  const providerModels = useMemo(() => {
    if (!value.provider) return [];
    const catalog = MODEL_CATALOGS[value.provider];
    return catalog?.models ?? [];
  }, [value.provider]);

  // Handle provider change - auto-select default model
  const handleProviderChange = (provider: string) => {
    const catalog = MODEL_CATALOGS[provider];
    const defaultModel = catalog?.defaultModel ?? '';
    onChange({ provider, model: defaultModel });
  };

  return (
    <div className="flex gap-2">
      {/* Provider dropdown */}
      <Select value={value.provider} onValueChange={handleProviderChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Select provider" />
        </SelectTrigger>
        <SelectContent>
          {providers.map((p) => (
            <SelectItem key={p.name} value={p.name}>
              <div className="flex items-center gap-2">
                {p.healthy ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                ) : (
                  <XCircle className="w-3 h-3 text-red-500" />
                )}
                <span>{p.name}</span>
                {p.latency !== undefined && p.latency > 0 && (
                  <Badge variant="outline" className="text-xs ml-auto">
                    {p.latency}ms
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Model dropdown - shows models from catalog */}
      <Select
        value={value.model}
        onValueChange={(model) => onChange({ ...value, model })}
        disabled={!value.provider}
      >
        <SelectTrigger className="flex-1 min-w-[200px]">
          <SelectValue placeholder={value.provider ? 'Select model' : 'Select provider first'} />
        </SelectTrigger>
        <SelectContent>
          {providerModels.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <div className="flex flex-col">
                <span>{m.name}</span>
                {m.description && (
                  <span className="text-xs text-muted-foreground">{m.description}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Show health error if provider unhealthy */}
      {selectedProvider && !selectedProvider.healthy && selectedProvider.error && (
        <span className="text-xs text-destructive self-center truncate max-w-[120px]">
          {selectedProvider.error}
        </span>
      )}
    </div>
  );
}
