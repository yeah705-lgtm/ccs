/**
 * Router Profiles Hooks - React Query hooks for router profile management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { CreateRouterProfile, UpdateRouterProfile } from '@/lib/router-types';
import { toast } from 'sonner';

const QUERY_KEY = ['router', 'profiles'];

/**
 * Fetch all router profiles
 */
export function useRouterProfiles() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.router.profiles.list(),
  });
}

/**
 * Fetch single router profile by name
 */
export function useRouterProfile(name: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, name],
    queryFn: () => api.router.profiles.get(name),
    enabled: !!name,
  });
}

/**
 * Create a new router profile
 */
export function useCreateRouterProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRouterProfile) => api.router.profiles.create(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(`Profile '${variables.name}' created`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Update an existing router profile
 */
export function useUpdateRouterProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: UpdateRouterProfile }) =>
      api.router.profiles.update(name, data),
    onSuccess: (_, { name }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, name] });
      toast.success('Profile updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Delete a router profile
 */
export function useDeleteRouterProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.router.profiles.delete(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Profile deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Test a router profile configuration
 */
export function useTestRouterProfile() {
  return useMutation({
    mutationFn: (name: string) => api.router.profiles.test(name),
    onSuccess: (data) => {
      const allValid = Object.values(data.results).every((r) => r?.valid);
      if (allValid) {
        toast.success('All tiers validated successfully');
      } else {
        toast.warning('Some tiers have issues');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ==================== Router Settings Hooks ====================

const SETTINGS_QUERY_KEY = ['router', 'settings'];

/**
 * Fetch router profile settings (generated or customized)
 */
export function useRouterProfileSettings(name: string) {
  return useQuery({
    queryKey: [...SETTINGS_QUERY_KEY, name],
    queryFn: () => api.router.profiles.getSettings(name),
    enabled: !!name,
  });
}

/**
 * Update router profile settings
 */
export function useUpdateRouterProfileSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      name,
      settings,
      expectedMtime,
    }: {
      name: string;
      settings: { env: Record<string, string> };
      expectedMtime?: number;
    }) => api.router.profiles.updateSettings(name, settings, expectedMtime),
    onSuccess: (_, { name }) => {
      queryClient.invalidateQueries({ queryKey: [...SETTINGS_QUERY_KEY, name] });
      toast.success('Settings saved');
    },
    onError: (error: Error) => {
      if (error.message.includes('modified externally')) {
        toast.error('File modified externally. Refresh and try again.');
      } else {
        toast.error(error.message);
      }
    },
  });
}

/**
 * Regenerate router profile settings from profile config
 */
export function useRegenerateRouterProfileSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.router.profiles.regenerateSettings(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: [...SETTINGS_QUERY_KEY, name] });
      toast.success('Settings regenerated from profile');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
