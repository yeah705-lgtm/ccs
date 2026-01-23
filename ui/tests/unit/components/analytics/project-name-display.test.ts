/**
 * Project Name Display Tests
 * Unit tests for getProjectDisplayName function
 */

import { describe, it, expect } from 'vitest';

// Import the function from the utility
import { getProjectDisplayName } from '../../../../src/components/analytics/project-name-utils';

describe('getProjectDisplayName', () => {
  describe('Simple project paths', () => {
    it('returns the leaf folder name for simple paths', () => {
      expect(getProjectDisplayName('/home/user/projects/my-app')).toBe('my-app');
      expect(getProjectDisplayName('/Users/joe/Developer/share-pi')).toBe('share-pi');
      expect(getProjectDisplayName('/var/www/html')).toBe('html');
    });

    it('handles paths without leading/trailing slashes', () => {
      expect(getProjectDisplayName('home/user/projects/my-app')).toBe('my-app');
      expect(getProjectDisplayName('Users/joe/Developer/share-pi')).toBe('share-pi');
    });
  });

  describe('Complex project paths', () => {
    it('returns leaf folder for worktree paths', () => {
      expect(
        getProjectDisplayName(
          '/Users/joe/Developer/ExaDev/Clients/Architect/repositories/architect/worktrees/2026-01-08'
        )
      ).toBe('2026-01-08');
      expect(
        getProjectDisplayName('/home/user/workspaces/repo-name/worktrees/feature-branch')
      ).toBe('feature-branch');
      expect(getProjectDisplayName('/project/repo/worktrees/v2.0')).toBe('v2.0');
    });

    it('handles nested paths', () => {
      expect(getProjectDisplayName('/home/user/projects/web-dashboard/src/components')).toBe(
        'components'
      );
      expect(getProjectDisplayName('/opt/apps/my-app/lib/utils')).toBe('utils');
    });
  });

  describe('Edge cases', () => {
    it('handles empty string', () => {
      expect(getProjectDisplayName('')).toBe('');
    });

    it('handles only slashes', () => {
      expect(getProjectDisplayName('///')).toBe('');
      expect(getProjectDisplayName('/')).toBe('');
    });

    it('handles single segment paths', () => {
      expect(getProjectDisplayName('my-app')).toBe('my-app');
      expect(getProjectDisplayName('project')).toBe('project');
    });

    it('handles paths with trailing slash', () => {
      expect(getProjectDisplayName('/home/user/projects/my-app/')).toBe('my-app');
      expect(getProjectDisplayName('/Users/joe/Developer/share-pi/')).toBe('share-pi');
    });

    it('handles paths with leading slash only', () => {
      expect(getProjectDisplayName('/my-app')).toBe('my-app');
      expect(getProjectDisplayName('/project')).toBe('project');
    });
  });

  describe('Real-world examples from the bug report', () => {
    it('displays correct project name for share-pi project', () => {
      // Before fix: would show "pi"
      // After fix: should show "share-pi"
      const path = '/Users/joe/Developer/share-pi';
      expect(getProjectDisplayName(path)).toBe('share-pi');
    });

    it('displays correct project name for worktree project', () => {
      // Before fix: would show "08"
      // After fix: should show "2026-01-08"
      const path =
        '/Users/joe/Developer/ExaDev/Clients/Architect/repositories/architect.worktrees/2026-01-08';
      expect(getProjectDisplayName(path)).toBe('2026-01-08');
    });

    it('displays correct project name for nested project', () => {
      // Example: a project in a subdirectory
      const path = '/home/user/dev/company/projects/web-app';
      expect(getProjectDisplayName(path)).toBe('web-app');
    });

    it('displays correct project name for repo with worktrees', () => {
      // Example: main repository
      const path = '/Users/joe/Developer/my-repo';
      expect(getProjectDisplayName(path)).toBe('my-repo');
    });

    it('displays correct project name for feature branch worktree', () => {
      // Example: feature branch worktree
      const path = '/Users/joe/Developer/my-repo/.git/worktrees/feature-x';
      expect(getProjectDisplayName(path)).toBe('feature-x');
    });
  });

  describe('Regression tests', () => {
    it('does not return empty string for valid paths', () => {
      const testCases = ['/project', '/home/user/app', '/var/log/nginx', '/tmp/test-file'];

      testCases.forEach((path) => {
        const result = getProjectDisplayName(path);
        expect(result).not.toBe('');
        expect(result).not.toBeUndefined();
        expect(result).not.toBeNull();
      });
    });

    it('handles paths with special characters', () => {
      expect(getProjectDisplayName('/home/user/my-project_v2')).toBe('my-project_v2');
      expect(getProjectDisplayName('/home/user/project-with-dashes')).toBe('project-with-dashes');
      expect(getProjectDisplayName('/home/user/project.with.dots')).toBe('project.with.dots');
    });

    it('handles numeric paths correctly', () => {
      expect(getProjectDisplayName('/home/user/project123')).toBe('project123');
      expect(getProjectDisplayName('/home/user/123project')).toBe('123project');
      expect(getProjectDisplayName('/home/user/v1.2.3')).toBe('v1.2.3');
    });
  });
});
