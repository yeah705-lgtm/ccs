// Router configuration schemas barrel export

export {
  tierConfigSchema,
  routerProfileSchema,
  apiProviderConfigSchema,
  routerDefaultsSchema,
  routerConfigSchema,
  validateRouterConfig,
} from './schema';

export type {
  TierConfig,
  RouterProfile,
  ApiProviderConfig,
  RouterDefaults,
  RouterConfig,
} from './schema';

// Config loader functions
export {
  loadRouterConfig,
  getRouterProfile,
  listRouterProfiles,
  isRouterProfile,
  getRouterPort,
} from './loader';

// Validator functions
export {
  validateProfile,
  validateRouterConfig as validateAllProfiles,
  isProfileRunnable,
} from './validator';
export type { ValidationResult } from './validator';

// Generator functions
export {
  generateRouterSettings,
  writeRouterSettings,
  getRouterSettingsPath,
  getRouterEnvVars,
} from './generator';
export type { RouterSettings } from './generator';
