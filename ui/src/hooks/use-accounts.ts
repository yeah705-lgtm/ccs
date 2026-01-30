/**
 * React Query hooks for accounts (profiles.json)
 * Dashboard parity: Full CRUD operations for auth profiles
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
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

export function useSetAccountWeight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      provider,
      accountId,
      weight,
    }: {
      provider: string;
      accountId: string;
      weight: number;
    }) => api.cliproxy.accounts.setWeight(provider, accountId, weight),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliproxy-auth'] });
      toast.success('Account weight updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
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

export function useSetTierDefaults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tierWeights: Record<string, number>) =>
      api.cliproxy.weight.setTierDefaults(tierWeights),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliproxy-auth'] });
      toast.success('Tier defaults applied successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
