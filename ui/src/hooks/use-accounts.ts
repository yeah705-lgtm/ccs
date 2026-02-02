/**
 * React Query hooks for accounts (profiles.json)
 * Dashboard parity: Full CRUD operations for auth profiles
 */

import { useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type AuthStatus } from '@/lib/api-client';
import { toast } from 'sonner';

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
  });
}

export function useSetDefaultAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.accounts.setDefault(name),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(`Default account set to "${name}"`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useResetDefaultAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.accounts.resetDefault(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Default account reset to CCS');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.accounts.delete(name),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(`Account "${name}" deleted`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

type WeightMutationVars = { provider: string; accountId: string; weight: number };

/**
 * Raw weight mutation with optimistic cache update.
 * Skips cliproxy-auth refetch on success (weight already in cache).
 * On error, rolls back cache and shows toast.
 */
export function useSetAccountWeight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ provider, accountId, weight }: WeightMutationVars) =>
      api.cliproxy.accounts.setWeight(provider, accountId, weight),
    onMutate: async ({ provider, accountId, weight }) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ['cliproxy-auth'] });

      const previous = queryClient.getQueryData<{ authStatus: AuthStatus[] }>(['cliproxy-auth']);

      // Optimistic update: set weight in cache immediately
      if (previous) {
        queryClient.setQueryData<{ authStatus: AuthStatus[] }>(['cliproxy-auth'], {
          ...previous,
          authStatus: previous.authStatus.map((status) =>
            status.provider === provider
              ? {
                  ...status,
                  accounts: status.accounts.map((acc) =>
                    acc.id === accountId ? { ...acc, weight } : acc
                  ),
                }
              : status
          ),
        });
      }

      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      // Rollback on failure
      if (context?.previous) {
        queryClient.setQueryData(['cliproxy-auth'], context.previous);
      }
      toast.error(error.message);
    },
    // No onSuccess invalidation — optimistic update already reflects the change
    // Background sync on the server handles file creation without needing UI refetch
  });
}

/**
 * Debounced weight change hook.
 * Coalesces rapid weight changes per-account, firing the mutation only after 300ms of inactivity.
 * Returns a stable callback that can be passed directly to onWeightChange props.
 */
export function useDebouncedWeightChange() {
  const mutation = useSetAccountWeight();
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const debouncedMutate = useCallback(
    (vars: WeightMutationVars) => {
      const key = `${vars.provider}:${vars.accountId}`;

      // Clear previous timer for this account
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);

      // Set new timer — mutation fires after 300ms of no further changes
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key);
          mutation.mutate(vars);
        }, 300)
      );
    },
    [mutation]
  );

  return { debouncedMutate, ...mutation };
}

export function useSyncWeights() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.cliproxy.weight.sync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliproxy-auth'] });
      toast.success('Weights synced successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Set tier default weights with optimistic cache update.
 * Updates all accounts matching the tier(s) immediately in the cache.
 * Skips cliproxy-auth refetch on success (weights already in cache).
 * On error, rolls back cache and shows toast.
 */
export function useSetTierDefaults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tierWeights: Record<string, number>) =>
      api.cliproxy.weight.setTierDefaults(tierWeights),
    onMutate: async (tierWeights) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ['cliproxy-auth'] });

      const previous = queryClient.getQueryData<{ authStatus: AuthStatus[] }>(['cliproxy-auth']);

      // Optimistic update: set weight for all accounts matching the tier(s)
      if (previous) {
        queryClient.setQueryData<{ authStatus: AuthStatus[] }>(['cliproxy-auth'], {
          ...previous,
          authStatus: previous.authStatus.map((status) => ({
            ...status,
            accounts: status.accounts.map((acc) => {
              const tier = acc.tier || 'unknown';
              if (tier in tierWeights) {
                return { ...acc, weight: tierWeights[tier] };
              }
              return acc;
            }),
          })),
        });
      }

      return { previous };
    },
    onSuccess: () => {
      // No invalidation — optimistic update already reflects the change
      // Backend handles bulk sync without needing UI refetch
      toast.success('Tier defaults applied successfully');
    },
    onError: (error: Error, _vars, context) => {
      // Rollback on failure
      if (context?.previous) {
        queryClient.setQueryData(['cliproxy-auth'], context.previous);
      }
      toast.error(error.message);
    },
  });
}
