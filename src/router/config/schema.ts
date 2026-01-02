// Zod validation schemas for router configuration

import { z } from 'zod';

// TierConfig type for recursion
export interface TierConfig {
  provider: string;
  model: string;
  fallback?: TierConfig[];
}

// Tier configuration (with explicit type for lazy recursion)
export const tierConfigSchema: z.ZodType<TierConfig> = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  fallback: z.lazy(() => tierConfigSchema.array()).optional(),
});

// Router profile
export const routerProfileSchema = z.object({
  description: z.string().optional(),
  tiers: z.object({
    opus: tierConfigSchema,
    sonnet: tierConfigSchema,
    haiku: tierConfigSchema,
  }),
});

// API provider configuration
export const apiProviderConfigSchema = z.object({
  adapter: z.enum(['anthropic', 'openai-compat', 'openrouter', 'custom']),
  base_url: z.string().url(),
  auth_env: z.string().min(1),
  models: z.array(z.string()),
  headers: z.record(z.string(), z.string()).optional(),
});

// Router defaults
export const routerDefaultsSchema = z.object({
  timeout: z
    .string()
    .regex(/^\d+s$/)
    .optional()
    .default('120s'),
  retries: z.number().int().min(0).max(5).optional().default(2),
});

// Full router configuration
export const routerConfigSchema = z.object({
  port: z.number().int().min(1024).max(65535).optional().default(9400),
  defaults: routerDefaultsSchema.optional(),
  providers: z.record(z.string(), apiProviderConfigSchema).optional(),
  profiles: z.record(z.string(), routerProfileSchema),
});

// Type inference (TierConfig is defined explicitly above for recursion)
export type RouterProfile = z.infer<typeof routerProfileSchema>;
export type ApiProviderConfig = z.infer<typeof apiProviderConfigSchema>;
export type RouterDefaults = z.infer<typeof routerDefaultsSchema>;
export type RouterConfig = z.infer<typeof routerConfigSchema>;

// Validation helper
export function validateRouterConfig(config: unknown): RouterConfig {
  return routerConfigSchema.parse(config);
}
