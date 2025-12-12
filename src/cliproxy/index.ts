/**
 * CLIProxy Module Exports
 * Central export point for CLIProxyAPI binary management and execution
 */

// Types
export type {
  PlatformInfo,
  SupportedOS,
  SupportedArch,
  ArchiveExtension,
  BinaryManagerConfig,
  BinaryInfo,
  DownloadProgress,
  ProgressCallback,
  ChecksumResult,
  DownloadResult,
  CLIProxyProvider,
  CLIProxyConfig,
  ExecutorConfig,
  ProviderConfig,
  ProviderModelMapping,
} from './types';

// Platform detection
export {
  detectPlatform,
  getDownloadUrl,
  getChecksumsUrl,
  getExecutableName,
  getArchiveBinaryName,
  isPlatformSupported,
  getPlatformDescription,
  CLIPROXY_VERSION,
} from './platform-detector';

// Binary management
export {
  BinaryManager,
  ensureCLIProxyBinary,
  isCLIProxyInstalled,
  getCLIProxyPath,
  getInstalledCliproxyVersion,
  installCliproxyVersion,
  fetchLatestCliproxyVersion,
} from './binary-manager';

// Config generation
export {
  generateConfig,
  regenerateConfig,
  configNeedsRegeneration,
  getClaudeEnvVars,
  getEffectiveEnvVars,
  getProviderSettingsPath,
  ensureProviderSettings,
  getProviderConfig,
  getModelMapping,
  getCliproxyDir,
  getProviderAuthDir,
  getAuthDir,
  getConfigPath,
  getBinDir,
  configExists,
  deleteConfig,
  CLIPROXY_DEFAULT_PORT,
  CLIPROXY_CONFIG_VERSION,
} from './config-generator';

// Base config loader (for reading config/base-*.settings.json)
export {
  loadBaseConfig,
  getModelMappingFromConfig,
  getEnvVarsFromConfig,
  clearConfigCache,
} from './base-config-loader';

// Model catalog and configuration
export type { ModelEntry, ProviderCatalog } from './model-catalog';
export { MODEL_CATALOG, supportsModelConfig, getProviderCatalog, findModel } from './model-catalog';
export {
  hasUserSettings,
  getCurrentModel,
  configureProviderModel,
  showCurrentConfig,
} from './model-config';

// Executor
export { execClaudeWithCLIProxy, isPortAvailable, findAvailablePort } from './cliproxy-executor';

// Authentication
export type { AuthStatus } from './auth-handler';
export {
  isAuthenticated,
  getAuthStatus,
  getAllAuthStatus,
  clearAuth,
  triggerOAuth,
  ensureAuth,
  getOAuthConfig,
  getProviderTokenDir,
  displayAuthStatus,
} from './auth-handler';

// Stats fetcher
export type { CliproxyStats } from './stats-fetcher';
export { fetchCliproxyStats, isCliproxyRunning } from './stats-fetcher';

// OpenAI compatibility layer
export type { OpenAICompatProvider, OpenAICompatModel } from './openai-compat-manager';
export {
  listOpenAICompatProviders,
  getOpenAICompatProvider,
  addOpenAICompatProvider,
  updateOpenAICompatProvider,
  removeOpenAICompatProvider,
  OPENROUTER_TEMPLATE,
  TOGETHER_TEMPLATE,
} from './openai-compat-manager';

// Service manager (background CLIProxy for dashboard)
export type { ServiceStartResult } from './service-manager';
export { ensureCliproxyService, stopCliproxyService, getServiceStatus } from './service-manager';
