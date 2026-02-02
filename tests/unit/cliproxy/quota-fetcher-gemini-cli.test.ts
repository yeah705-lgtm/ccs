/**
 * Gemini CLI Quota Fetcher Unit Tests
 *
 * Tests for Gemini CLI bucket parsing and transformation logic
 */

import { describe, it, expect } from 'bun:test';
import {
  buildGeminiCliBuckets,
  resolveGeminiCliProjectId,
} from '../../../src/cliproxy/quota-fetcher-gemini-cli';

describe('Gemini CLI Quota Fetcher', () => {
  describe('resolveGeminiCliProjectId', () => {
    it('should extract project ID from account field', () => {
      const account = 'user@example.com (cloudaicompanion-abc-123)';
      const projectId = resolveGeminiCliProjectId(account);
      expect(projectId).toBe('cloudaicompanion-abc-123');
    });

    it('should return last parenthetical when multiple exist', () => {
      const account = 'user (org) (cloudaicompanion-xyz-789)';
      const projectId = resolveGeminiCliProjectId(account);
      expect(projectId).toBe('cloudaicompanion-xyz-789');
    });

    it('should return null for account without parentheses', () => {
      const account = 'user@example.com';
      const projectId = resolveGeminiCliProjectId(account);
      expect(projectId).toBeNull();
    });

    it('should return null for empty string', () => {
      const projectId = resolveGeminiCliProjectId('');
      expect(projectId).toBeNull();
    });

    it('should handle nested parentheses', () => {
      const account = 'user@example.com (project-id)';
      const projectId = resolveGeminiCliProjectId(account);
      expect(projectId).toBe('project-id');
    });
  });

  describe('buildGeminiCliBuckets', () => {
    it('should group models by series', () => {
      const rawBuckets = [
        { model_id: 'gemini-3-flash-preview', remaining_fraction: 0.8 },
        { model_id: 'gemini-2.5-flash', remaining_fraction: 0.6 },
        { model_id: 'gemini-3-pro-preview', remaining_fraction: 0.9 },
      ];

      const buckets = buildGeminiCliBuckets(rawBuckets);

      // Should have 2 groups: Flash Series and Pro Series
      expect(buckets.length).toBeGreaterThanOrEqual(2);

      const flashBucket = buckets.find((b) => b.label === 'Gemini Flash Series');
      expect(flashBucket).toBeDefined();
      // Takes minimum remaining fraction (0.6)
      expect(flashBucket!.remainingFraction).toBe(0.6);
      expect(flashBucket!.remainingPercent).toBe(60);

      const proBucket = buckets.find((b) => b.label === 'Gemini Pro Series');
      expect(proBucket).toBeDefined();
      expect(proBucket!.remainingFraction).toBe(0.9);
    });

    it('should handle camelCase API response', () => {
      const rawBuckets = [{ modelId: 'gemini-3-flash-preview', remainingFraction: 0.75 }];

      const buckets = buildGeminiCliBuckets(rawBuckets);

      expect(buckets).toHaveLength(1);
      expect(buckets[0].remainingFraction).toBe(0.75);
    });

    it('should clamp remainingFraction to 0-1 range', () => {
      const rawBuckets = [
        { model_id: 'gemini-3-flash-preview', remaining_fraction: 1.5 },
        { model_id: 'gemini-3-pro-preview', remaining_fraction: -0.2 },
      ];

      const buckets = buildGeminiCliBuckets(rawBuckets);

      const flashBucket = buckets.find((b) => b.label === 'Gemini Flash Series');
      expect(flashBucket!.remainingFraction).toBe(1);
      expect(flashBucket!.remainingPercent).toBe(100);

      const proBucket = buckets.find((b) => b.label === 'Gemini Pro Series');
      expect(proBucket!.remainingFraction).toBe(0);
      expect(proBucket!.remainingPercent).toBe(0);
    });

    it('should group by token type', () => {
      const rawBuckets = [
        { model_id: 'gemini-3-flash-preview', token_type: 'input', remaining_fraction: 0.8 },
        { model_id: 'gemini-3-flash-preview', token_type: 'output', remaining_fraction: 0.5 },
      ];

      const buckets = buildGeminiCliBuckets(rawBuckets);

      // Should have separate buckets for input and output
      expect(buckets.length).toBe(2);
      const inputBucket = buckets.find((b) => b.tokenType === 'input');
      const outputBucket = buckets.find((b) => b.tokenType === 'output');
      expect(inputBucket).toBeDefined();
      expect(outputBucket).toBeDefined();
      expect(inputBucket!.remainingFraction).toBe(0.8);
      expect(outputBucket!.remainingFraction).toBe(0.5);
    });

    it('should ignore deprecated models', () => {
      const rawBuckets = [
        { model_id: 'gemini-2.0-flash-deprecated', remaining_fraction: 0.1 },
        { model_id: 'gemini-3-flash-preview', remaining_fraction: 0.9 },
      ];

      const buckets = buildGeminiCliBuckets(rawBuckets);

      // Only gemini-3-flash-preview should be included
      expect(buckets).toHaveLength(1);
      expect(buckets[0].remainingFraction).toBe(0.9);
    });

    it('should categorize unknown models as "other"', () => {
      const rawBuckets = [{ model_id: 'unknown-model-xyz', remaining_fraction: 0.7 }];

      const buckets = buildGeminiCliBuckets(rawBuckets);

      expect(buckets).toHaveLength(1);
      expect(buckets[0].label).toBe('Other Models');
    });

    it('should handle empty buckets array', () => {
      const buckets = buildGeminiCliBuckets([]);
      expect(buckets).toHaveLength(0);
    });

    it('should skip buckets with empty model_id', () => {
      const rawBuckets = [
        { model_id: '', remaining_fraction: 0.5 },
        { model_id: 'gemini-3-flash-preview', remaining_fraction: 0.8 },
      ];

      const buckets = buildGeminiCliBuckets(rawBuckets);

      expect(buckets).toHaveLength(1);
      expect(buckets[0].remainingFraction).toBe(0.8);
    });

    it('should keep earliest reset time when merging', () => {
      const rawBuckets = [
        {
          model_id: 'gemini-3-flash-preview',
          remaining_fraction: 0.8,
          reset_time: '2026-01-30T12:00:00Z',
        },
        {
          model_id: 'gemini-2.5-flash',
          remaining_fraction: 0.6,
          reset_time: '2026-01-30T10:00:00Z', // Earlier
        },
      ];

      const buckets = buildGeminiCliBuckets(rawBuckets);

      const flashBucket = buckets.find((b) => b.label === 'Gemini Flash Series');
      expect(flashBucket!.resetTime).toBe('2026-01-30T10:00:00Z');
    });

    it('should default remainingFraction to 1 when missing', () => {
      const rawBuckets = [{ model_id: 'gemini-3-flash-preview' }];

      const buckets = buildGeminiCliBuckets(rawBuckets);

      expect(buckets[0].remainingFraction).toBe(1);
      expect(buckets[0].remainingPercent).toBe(100);
    });

    it('should collect modelIds in bucket', () => {
      const rawBuckets = [
        { model_id: 'gemini-3-flash-preview', remaining_fraction: 0.8 },
        { model_id: 'gemini-2.5-flash', remaining_fraction: 0.6 },
      ];

      const buckets = buildGeminiCliBuckets(rawBuckets);

      const flashBucket = buckets.find((b) => b.label === 'Gemini Flash Series');
      expect(flashBucket!.modelIds).toContain('gemini-3-flash-preview');
      expect(flashBucket!.modelIds).toContain('gemini-2.5-flash');
    });
  });
});
