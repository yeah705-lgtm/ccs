/**
 * Model Catalogs for CLIProxy providers
 * Shared data for Quick Setup Wizard and Provider Editor
 */

import type { ProviderCatalog } from '@/components/cliproxy/provider-model-selector';

/** Model catalog data - mirrors src/cliproxy/model-catalog.ts */
export const MODEL_CATALOGS: Record<string, ProviderCatalog> = {
  agy: {
    provider: 'agy',
    displayName: 'Antigravity',
    defaultModel: 'gemini-claude-opus-4-5-thinking',
    models: [
      {
        id: 'gemini-claude-opus-4-5-thinking',
        name: 'Claude Opus 4.5 Thinking',
        description: 'Most capable, extended thinking',
        presetMapping: {
          default: 'gemini-claude-opus-4-5-thinking',
          opus: 'gemini-claude-opus-4-5-thinking',
          sonnet: 'gemini-claude-sonnet-4-5-thinking',
          haiku: 'gemini-claude-sonnet-4-5',
        },
      },
      {
        id: 'gemini-claude-sonnet-4-5-thinking',
        name: 'Claude Sonnet 4.5 Thinking',
        description: 'Balanced with extended thinking',
        presetMapping: {
          default: 'gemini-claude-sonnet-4-5-thinking',
          opus: 'gemini-claude-opus-4-5-thinking',
          sonnet: 'gemini-claude-sonnet-4-5-thinking',
          haiku: 'gemini-claude-sonnet-4-5',
        },
      },
      {
        id: 'gemini-claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5',
        description: 'Fast and capable',
        presetMapping: {
          default: 'gemini-claude-sonnet-4-5',
          opus: 'gemini-claude-opus-4-5-thinking',
          sonnet: 'gemini-claude-sonnet-4-5',
          haiku: 'gemini-claude-sonnet-4-5',
        },
      },
      {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        description: 'Google latest model via Antigravity',
        presetMapping: {
          default: 'gemini-3-pro-preview',
          opus: 'gemini-3-pro-preview',
          sonnet: 'gemini-3-pro-preview',
          haiku: 'gemini-2.5-flash',
        },
      },
    ],
  },
  gemini: {
    provider: 'gemini',
    displayName: 'Gemini',
    defaultModel: 'gemini-2.5-pro',
    models: [
      {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        tier: 'paid',
        description: 'Latest model, requires paid Google account',
        presetMapping: {
          default: 'gemini-3-pro-preview',
          opus: 'gemini-3-pro-preview',
          sonnet: 'gemini-3-pro-preview',
          haiku: 'gemini-2.5-flash',
        },
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Stable, works with free Google account',
        presetMapping: {
          default: 'gemini-2.5-pro',
          opus: 'gemini-2.5-pro',
          sonnet: 'gemini-2.5-pro',
          haiku: 'gemini-2.5-flash',
        },
      },
    ],
  },
  codex: {
    provider: 'codex',
    displayName: 'Codex',
    defaultModel: 'gpt-5.1-codex-max',
    models: [
      {
        id: 'gpt-5.1-codex-max',
        name: 'Codex Max (5.1)',
        description: 'Most capable Codex model',
        presetMapping: {
          default: 'gpt-5.1-codex-max',
          opus: 'gpt-5.1-codex-max-high',
          sonnet: 'gpt-5.1-codex-max',
          haiku: 'gpt-5.1-codex-mini-high',
        },
      },
      {
        id: 'gpt-5.2',
        name: 'GPT 5.2',
        description: 'Latest GPT model',
        presetMapping: {
          default: 'gpt-5.2',
          opus: 'gpt-5.2',
          sonnet: 'gpt-5.2',
          haiku: 'gpt-5.2',
        },
      },
      {
        id: 'gpt-5.1-codex-mini',
        name: 'Codex Mini',
        description: 'Fast and efficient Codex model',
      },
    ],
  },
  qwen: {
    provider: 'qwen',
    displayName: 'Qwen',
    defaultModel: 'qwen-coder-plus',
    models: [
      {
        id: 'qwen-coder-plus',
        name: 'Qwen Coder Plus',
        description: 'Alibaba code-focused model',
      },
      {
        id: 'qwen-max',
        name: 'Qwen Max',
        description: 'Most capable Qwen model',
      },
    ],
  },
  iflow: {
    provider: 'iflow',
    displayName: 'iFlow',
    defaultModel: 'iflow-default',
    models: [
      {
        id: 'iflow-default',
        name: 'iFlow Default',
        description: 'Default iFlow model',
      },
    ],
  },
};
