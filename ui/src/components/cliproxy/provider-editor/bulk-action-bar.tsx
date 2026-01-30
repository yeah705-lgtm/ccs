/**
 * Bulk Action Bar Component
 * Appears when accounts are selected for bulk pause/resume operations
 */

import { Button } from '@/components/ui/button';
import { Pause, Play, Loader2, Scale } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BulkActionBarProps {
  selectedCount: number;
  onPauseSelected: () => void;
  onResumeSelected: () => void;
  onClearSelection: () => void;
  isPausing: boolean;
  isResuming: boolean;
  onSetAllUltraWeights?: (weight: number) => void;
  isSettingWeights?: boolean;
}

export function BulkActionBar({
  selectedCount,
  onPauseSelected,
  onResumeSelected,
  onClearSelection,
  isPausing,
  isResuming,
  onSetAllUltraWeights,
  isSettingWeights,
}: BulkActionBarProps) {
  // Show bar when at least 1 account is selected (per validation decision)
  if (selectedCount < 1) return null;

  const isLoading = isPausing || isResuming || isSettingWeights;

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-muted/50 rounded-lg border mt-2">
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {selectedCount} selected
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs h-6 px-2"
        onClick={onClearSelection}
        disabled={isLoading}
      >
        Clear
      </Button>
      <div className="flex flex-wrap gap-2 ml-auto">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={onPauseSelected}
          disabled={isLoading}
        >
          {isPausing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
          Pause Selected
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={onResumeSelected}
          disabled={isLoading}
        >
          {isResuming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Resume Selected
        </Button>
        {onSetAllUltraWeights && (
          <div className="flex items-center gap-1.5 pl-2 border-l">
            <Scale className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Ultra:</span>
            <Select
              defaultValue="4"
              onValueChange={(val) => onSetAllUltraWeights(parseInt(val))}
              disabled={isLoading}
            >
              <SelectTrigger className="h-7 w-14 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((w) => (
                  <SelectItem key={w} value={w.toString()}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
