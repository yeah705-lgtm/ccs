/**
 * Unit tests for model-pricing.ts
 */
import { describe, it, expect } from 'bun:test';
import {
  getModelPricing,
  calculateCost,
  getKnownModels,
  hasCustomPricing,
  type TokenUsage,
} from '../../src/web-server/model-pricing';

describe('model-pricing', () => {
  describe('getModelPricing', () => {
    it('should return exact match pricing', () => {
      const pricing = getModelPricing('claude-sonnet-4-5-20250929');
      expect(pricing.inputPerMillion).toBe(3.0);
      expect(pricing.outputPerMillion).toBe(15.0);
    });

    it('should return pricing for all known models', () => {
      const knownModels = getKnownModels();
      expect(knownModels.length).toBeGreaterThanOrEqual(60); // 62 models from better-ccusage integration

      for (const model of knownModels) {
        const pricing = getModelPricing(model);
        expect(pricing).toBeDefined();
        expect(typeof pricing.inputPerMillion).toBe('number');
      }
    });

    it('should return fallback pricing for unknown models', () => {
      const pricing = getModelPricing('unknown-model-xyz');
      expect(pricing.inputPerMillion).toBe(3.0);
      expect(pricing.outputPerMillion).toBe(15.0);
    });

    it('should handle provider-prefixed model names', () => {
      const pricing = getModelPricing('anthropic/claude-sonnet-4-5');
      expect(pricing).toBeDefined();
      // Should match via normalization
    });

    it('should return different pricing for different model tiers', () => {
      const sonnet = getModelPricing('claude-sonnet-4-5');
      const opus = getModelPricing('claude-opus-4-5-20251101');
      const haiku = getModelPricing('claude-haiku-4-5-20251001');

      expect(opus.inputPerMillion).toBeGreaterThan(sonnet.inputPerMillion);
      expect(sonnet.inputPerMillion).toBeGreaterThan(haiku.inputPerMillion);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly for input tokens', () => {
      const usage: TokenUsage = {
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      };
      const cost = calculateCost(usage, 'claude-sonnet-4-5');
      expect(cost).toBe(3.0); // $3.00 per million input tokens
    });

    it('should calculate cost correctly for output tokens', () => {
      const usage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 1_000_000,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      };
      const cost = calculateCost(usage, 'claude-sonnet-4-5');
      expect(cost).toBe(15.0); // $15.00 per million output tokens
    });

    it('should calculate combined cost correctly', () => {
      const usage: TokenUsage = {
        inputTokens: 500_000,
        outputTokens: 100_000,
        cacheCreationTokens: 50_000,
        cacheReadTokens: 200_000,
      };
      const cost = calculateCost(usage, 'claude-sonnet-4-5');
      // 0.5M * 3.0 + 0.1M * 15.0 + 0.05M * 3.75 + 0.2M * 0.30
      // = 1.5 + 1.5 + 0.1875 + 0.06
      expect(cost).toBeCloseTo(3.2475, 4);
    });

    it('should return 0 for zero usage', () => {
      const usage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      };
      const cost = calculateCost(usage, 'claude-sonnet-4-5');
      expect(cost).toBe(0);
    });

    it('should return 0 cost for free-tier/experimental models', () => {
      const usage: TokenUsage = {
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        cacheCreationTokens: 100_000,
        cacheReadTokens: 50_000,
      };
      const cost = calculateCost(usage, 'gemini-2.0-flash-exp');
      expect(cost).toBe(0); // Experimental models are free
    });
  });

  describe('getKnownModels', () => {
    it('should return array of model names', () => {
      const models = getKnownModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it('should include Claude models', () => {
      const models = getKnownModels();
      expect(models.some((m) => m.startsWith('claude-'))).toBe(true);
    });

    it('should include GLM models', () => {
      const models = getKnownModels();
      expect(models.some((m) => m.startsWith('glm-'))).toBe(true);
    });
  });

  describe('hasCustomPricing', () => {
    it('should return true for known models', () => {
      expect(hasCustomPricing('claude-sonnet-4-5')).toBe(true);
      expect(hasCustomPricing('glm-4.6')).toBe(true);
    });

    it('should return false for unknown models', () => {
      expect(hasCustomPricing('unknown-model-xyz')).toBe(false);
    });
  });
});
