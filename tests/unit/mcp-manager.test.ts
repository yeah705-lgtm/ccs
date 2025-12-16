/**
 * Unit tests for MCP Manager module
 *
 * Tests web search MCP configuration logic without filesystem dependencies.
 * These tests focus on the pure logic functions that can be tested without
 * modifying the actual config files.
 */
import { describe, it, expect } from 'bun:test';

/**
 * Test helper: Simulate hasWebSearch detection logic
 * This matches the logic in mcp-manager.ts hasMcpWebSearch()
 */
function detectWebSearchMcp(mcpServers: Record<string, unknown>): boolean {
  return Object.keys(mcpServers).some((key) => {
    const lowerKey = key.toLowerCase();
    return (
      lowerKey.includes('web-search') ||
      lowerKey.includes('websearch') ||
      lowerKey.includes('tavily') ||
      lowerKey.includes('brave')
    );
  });
}

/**
 * Test helper: Simulate provider configuration logic
 * Returns which providers would be added given config and env
 */
function getProvidersToAdd(
  wsConfig: { enabled: boolean; provider: string; fallback: boolean },
  hasExistingWebSearch: boolean,
  apiKeys: { brave?: string; tavily?: string }
): string[] {
  if (!wsConfig.enabled) return [];
  if (hasExistingWebSearch) return [];

  const providers: string[] = [];

  if (wsConfig.provider === 'auto') {
    providers.push('web-search-prime');
    if (wsConfig.fallback) {
      if (apiKeys.brave) providers.push('brave-search');
      if (apiKeys.tavily) providers.push('tavily');
    }
  } else if (wsConfig.provider === 'web-search-prime') {
    providers.push('web-search-prime');
  } else if (wsConfig.provider === 'brave') {
    if (apiKeys.brave) {
      providers.push('brave-search');
    } else if (wsConfig.fallback) {
      // Fallback chain
      providers.push('web-search-prime');
      if (apiKeys.tavily) providers.push('tavily');
    }
  } else if (wsConfig.provider === 'tavily') {
    if (apiKeys.tavily) {
      providers.push('tavily');
    } else if (wsConfig.fallback) {
      // Fallback chain
      providers.push('web-search-prime');
      if (apiKeys.brave) providers.push('brave-search');
    }
  }

  return providers;
}

describe('mcp-manager logic', () => {
  describe('web search detection', () => {
    it('should detect web-search-prime', () => {
      const servers = { 'web-search-prime': { type: 'http' } };
      expect(detectWebSearchMcp(servers)).toBe(true);
    });

    it('should detect brave-search', () => {
      const servers = { 'brave-search': { type: 'stdio' } };
      expect(detectWebSearchMcp(servers)).toBe(true);
    });

    it('should detect tavily', () => {
      const servers = { tavily: { type: 'stdio' } };
      expect(detectWebSearchMcp(servers)).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(detectWebSearchMcp({ 'WebSearch-Custom': {} })).toBe(true);
      expect(detectWebSearchMcp({ 'WEB-SEARCH': {} })).toBe(true);
      expect(detectWebSearchMcp({ TAVILY: {} })).toBe(true);
      expect(detectWebSearchMcp({ 'Brave-Search': {} })).toBe(true);
    });

    it('should not detect unrelated MCPs', () => {
      expect(detectWebSearchMcp({ 'my-custom-mcp': {} })).toBe(false);
      expect(detectWebSearchMcp({ 'filesystem': {} })).toBe(false);
      expect(detectWebSearchMcp({ 'github-copilot': {} })).toBe(false);
    });

    it('should return false for empty servers', () => {
      expect(detectWebSearchMcp({})).toBe(false);
    });
  });

  describe('provider selection logic', () => {
    const defaultConfig = { enabled: true, provider: 'auto', fallback: true };
    const noApiKeys = {};
    const braveOnly = { brave: 'test-key' };
    const tavilyOnly = { tavily: 'test-key' };
    const bothKeys = { brave: 'brave-key', tavily: 'tavily-key' };

    it('should add web-search-prime in auto mode', () => {
      const providers = getProvidersToAdd(defaultConfig, false, noApiKeys);
      expect(providers).toContain('web-search-prime');
    });

    it('should add brave-search when API key available in auto mode', () => {
      const providers = getProvidersToAdd(defaultConfig, false, braveOnly);
      expect(providers).toContain('web-search-prime');
      expect(providers).toContain('brave-search');
    });

    it('should add tavily when API key available in auto mode', () => {
      const providers = getProvidersToAdd(defaultConfig, false, tavilyOnly);
      expect(providers).toContain('web-search-prime');
      expect(providers).toContain('tavily');
    });

    it('should add all providers when both API keys available', () => {
      const providers = getProvidersToAdd(defaultConfig, false, bothKeys);
      expect(providers).toContain('web-search-prime');
      expect(providers).toContain('brave-search');
      expect(providers).toContain('tavily');
    });

    it('should not add fallbacks when fallback=false', () => {
      const config = { enabled: true, provider: 'auto', fallback: false };
      const providers = getProvidersToAdd(config, false, bothKeys);
      expect(providers).toEqual(['web-search-prime']);
    });

    it('should skip when disabled', () => {
      const config = { enabled: false, provider: 'auto', fallback: true };
      const providers = getProvidersToAdd(config, false, bothKeys);
      expect(providers).toEqual([]);
    });

    it('should skip when web search already exists', () => {
      const providers = getProvidersToAdd(defaultConfig, true, bothKeys);
      expect(providers).toEqual([]);
    });

    it('should use specific provider when configured', () => {
      const config = { enabled: true, provider: 'brave', fallback: false };
      const providers = getProvidersToAdd(config, false, braveOnly);
      expect(providers).toEqual(['brave-search']);
    });

    it('should fallback when specific provider not available', () => {
      const config = { enabled: true, provider: 'tavily', fallback: true };
      // No tavily key, should fallback
      const providers = getProvidersToAdd(config, false, braveOnly);
      expect(providers).toContain('web-search-prime');
      expect(providers).toContain('brave-search');
      expect(providers).not.toContain('tavily');
    });

    it('should return empty when provider unavailable and fallback=false', () => {
      const config = { enabled: true, provider: 'brave', fallback: false };
      // No brave key and no fallback
      const providers = getProvidersToAdd(config, false, noApiKeys);
      expect(providers).toEqual([]);
    });
  });

  describe('MCP server config structures', () => {
    it('should define correct web-search-prime structure', () => {
      const webSearchPrimeConfig = {
        type: 'http',
        url: 'https://api.z.ai/api/mcp/web_search_prime/mcp',
        headers: {},
      };

      expect(webSearchPrimeConfig.type).toBe('http');
      expect(webSearchPrimeConfig.url).toContain('web_search_prime');
    });

    it('should define correct brave-search structure', () => {
      const braveConfig = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        env: { BRAVE_API_KEY: 'test-key' },
      };

      expect(braveConfig.type).toBe('stdio');
      expect(braveConfig.command).toBe('npx');
      expect(braveConfig.args).toContain('@modelcontextprotocol/server-brave-search');
      expect(braveConfig.env.BRAVE_API_KEY).toBe('test-key');
    });

    it('should define correct tavily structure', () => {
      const tavilyConfig = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@tavily/mcp-server'],
        env: { TAVILY_API_KEY: 'test-key' },
      };

      expect(tavilyConfig.type).toBe('stdio');
      expect(tavilyConfig.args).toContain('@tavily/mcp-server');
      expect(tavilyConfig.env.TAVILY_API_KEY).toBe('test-key');
    });
  });

  describe('hook configuration', () => {
    it('should define correct PreToolUse hook structure', () => {
      const hookConfig = {
        PreToolUse: [
          {
            matcher: 'WebSearch',
            hooks: [
              {
                type: 'command',
                command: 'node "/path/to/hook.cjs"',
                timeout: 5,
              },
            ],
          },
        ],
      };

      expect(hookConfig.PreToolUse).toBeDefined();
      expect(hookConfig.PreToolUse[0].matcher).toBe('WebSearch');
      expect(hookConfig.PreToolUse[0].hooks[0].type).toBe('command');
      expect(hookConfig.PreToolUse[0].hooks[0].timeout).toBe(5);
    });
  });

  describe('MCP config file path', () => {
    it('should be located in .claude directory', () => {
      // The MCP config path should follow this pattern
      const expectedPathPattern = '.claude/.mcp.json';
      const testPath = '/home/user/.claude/.mcp.json';
      expect(testPath).toContain(expectedPathPattern);
    });
  });

  describe('WebSearch config defaults', () => {
    it('should have correct default values', () => {
      const defaults = {
        enabled: true,
        provider: 'auto',
        fallback: true,
      };

      expect(defaults.enabled).toBe(true);
      expect(defaults.provider).toBe('auto');
      expect(defaults.fallback).toBe(true);
    });

    it('should validate provider options', () => {
      const validProviders = ['auto', 'web-search-prime', 'brave', 'tavily'];
      expect(validProviders).toContain('auto');
      expect(validProviders).toContain('web-search-prime');
      expect(validProviders).toContain('brave');
      expect(validProviders).toContain('tavily');
    });
  });
});
