/**
 * Router Profile Create Dialog
 * Modal dialog for creating new router profiles with proper name input
 */

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus, Route } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateRouterProfile } from '@/hooks/use-router-profiles';
import type { CreateRouterProfile } from '@/lib/router-types';

const schema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/, 'Must start with letter, only letters/numbers/.-_'),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface RouterProfileCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (name: string) => void;
}

// Default tier config for new profiles
const DEFAULT_TIER = { provider: '', model: '' };

// Generate unique suggested name
function generateSuggestedName(): string {
  const timestamp = Date.now().toString(36).slice(-4);
  return `router-${timestamp}`;
}

export function RouterProfileCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: RouterProfileCreateDialogProps) {
  const createMutation = useCreateRouterProfile();
  const [suggestedName, setSuggestedName] = useState('my-router');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      const suggested = generateSuggestedName();
      setSuggestedName(suggested);
      reset();
      setTimeout(() => {
        setValue('name', suggested);
      }, 0);
    }
  }, [open, reset, setValue]);

  const onSubmit = async (data: FormData) => {
    const newProfile: CreateRouterProfile = {
      name: data.name,
      description: data.description,
      tiers: {
        opus: { ...DEFAULT_TIER },
        sonnet: { ...DEFAULT_TIER },
        haiku: { ...DEFAULT_TIER },
      },
    };

    try {
      await createMutation.mutateAsync(newProfile);
      toast.success(`Profile "${data.name}" created`);
      onSuccess(data.name);
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to create profile');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="w-5 h-5 text-primary" />
            Create Router Profile
          </DialogTitle>
          <DialogDescription>
            Create a new router profile to route different Claude tiers to different providers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Profile Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Profile Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder={suggestedName}
              className="font-mono"
              autoFocus
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Used in CLI:{' '}
                <code className="bg-muted px-1 rounded text-[10px]">
                  ccs my-router &quot;prompt&quot;
                </code>
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="e.g., Route opus to Gemini, sonnet to AGY, haiku to GLM"
              rows={2}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Optional description to help identify this profile
            </p>
          </div>

          {/* Info about next steps */}
          <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">After creation:</p>
            <p>Configure tier mappings (Opus, Sonnet, Haiku) to route to different providers.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Profile
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
