/**
 * Environment Resolver - Build environment variables for Claude CLI
 *
 * Handles:
 * - Remote proxy environment configuration
 * - Local proxy environment configuration
 * - HTTPS tunnel integration
 * - Proxy chain configuration (CodexReasoning, ToolSanitization)
 * - WebSearch and ImageAnalysis hook integration
 */

import { getEffectiveEnvVars, getRemoteEnvVars, applyThinkingConfig } from '../config-generator';
import { CLIProxyProvider } from '../types';
import { getWebSearchHookEnv } from '../../utils/websearch-manager';
import { getImageAnalysisHookEnv } from '../../utils/hooks/get-image-analysis-hook-env';
import { CodexReasoningProxy } from '../codex-reasoning-proxy';
import { ToolSanitizationProxy } from '../tool-sanitization-proxy';
import { HttpsTunnelProxy } from '../https-tunnel-proxy';

export interface RemoteProxyConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https';
  authToken?: string;
}

export interface ProxyChainConfig {
  provider: CLIProxyProvider;
  useRemoteProxy: boolean;
  remoteConfig?: RemoteProxyConfig;
  httpsTunnel?: HttpsTunnelProxy;
  tunnelPort?: number;
  codexReasoningProxy?: CodexReasoningProxy;
  codexReasoningPort?: number;
  toolSanitizationProxy?: ToolSanitizationProxy;
  toolSanitizationPort?: number;
  localPort: number;
  customSettingsPath?: string;
  thinkingOverride?: string | number;
  verbose: boolean;
}

/**
 * Build final environment variables for Claude CLI execution
 * Handles proxy chain ordering and integration with hooks
 */
export function buildClaudeEnvironment(config: ProxyChainConfig): Record<string, string> {
  const {
    provider,
    useRemoteProxy,
    remoteConfig,
    httpsTunnel,
    tunnelPort,
    localPort,
    customSettingsPath,
    thinkingOverride,
    codexReasoningPort,
    toolSanitizationPort,
  } = config;

  // Build base env vars - remote or local
  let envVars: NodeJS.ProcessEnv;

  if (useRemoteProxy && remoteConfig) {
    if (httpsTunnel && tunnelPort) {
      // HTTPS remote via local tunnel - use HTTP to tunnel
      envVars = getRemoteEnvVars(
        provider,
        {
          host: '127.0.0.1',
          port: tunnelPort,
          protocol: 'http', // Tunnel speaks HTTP locally
          authToken: remoteConfig.authToken,
        },
        customSettingsPath
      );
    } else {
      // HTTP remote - direct connection
      envVars = getRemoteEnvVars(
        provider,
        {
          host: remoteConfig.host,
          port: remoteConfig.port,
          protocol: remoteConfig.protocol,
          authToken: remoteConfig.authToken,
        },
        customSettingsPath
      );
    }
  } else {
    // Local proxy mode
    const remoteRewriteConfig = remoteConfig
      ? {
          host: remoteConfig.host,
          port: remoteConfig.port,
          protocol: remoteConfig.protocol,
          authToken: remoteConfig.authToken,
        }
      : undefined;

    envVars = getEffectiveEnvVars(provider, localPort, customSettingsPath, remoteRewriteConfig);
  }

  // Apply thinking configuration to model (auto tier-based or manual override)
  applyThinkingConfig(envVars, provider, thinkingOverride);

  // Determine the final ANTHROPIC_BASE_URL based on active proxies
  // Chain order: Claude CLI → [CodexReasoningProxy] → [ToolSanitizationProxy] → CLIProxy
  let finalBaseUrl = envVars.ANTHROPIC_BASE_URL;

  if (toolSanitizationPort) {
    finalBaseUrl = `http://127.0.0.1:${toolSanitizationPort}`;
  }

  if (codexReasoningPort) {
    // Codex reasoning proxy is the outermost layer for codex provider
    finalBaseUrl = `http://127.0.0.1:${codexReasoningPort}/api/provider/codex`;
  }

  const effectiveEnvVars = {
    ...envVars,
    ANTHROPIC_BASE_URL: finalBaseUrl,
  };

  // Add hook environment variables
  const webSearchEnv = getWebSearchHookEnv();
  const imageAnalysisEnv = getImageAnalysisHookEnv(provider);

  // Merge all environment variables (filter undefined values)
  const baseEnv = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined)
  ) as Record<string, string>;

  const effectiveEnvVarsFiltered = Object.fromEntries(
    Object.entries(effectiveEnvVars).filter(([, v]) => v !== undefined)
  ) as Record<string, string>;

  return {
    ...baseEnv,
    ...effectiveEnvVarsFiltered,
    ...webSearchEnv,
    ...imageAnalysisEnv,
    CCS_PROFILE_TYPE: 'cliproxy', // Signal to WebSearch hook this is a third-party provider
  };
}

/**
 * Log environment configuration for debugging
 */
export function logEnvironment(
  env: Record<string, string>,
  webSearchEnv: Record<string, string>,
  verbose: boolean
): void {
  if (!verbose) return;

  const log = (msg: string) => console.error(`[cliproxy] ${msg}`);

  log(`Claude env: ANTHROPIC_BASE_URL=${env.ANTHROPIC_BASE_URL}`);
  log(`Claude env: ANTHROPIC_MODEL=${env.ANTHROPIC_MODEL}`);

  if (Object.keys(webSearchEnv).length > 0) {
    log(`Claude env: WebSearch config=${JSON.stringify(webSearchEnv)}`);
  }

  // Log global env vars for visibility
  if (env.DISABLE_TELEMETRY || env.DISABLE_ERROR_REPORTING || env.DISABLE_BUG_COMMAND) {
    log(`Claude env: Global env applied (telemetry/reporting disabled)`);
  }
}
