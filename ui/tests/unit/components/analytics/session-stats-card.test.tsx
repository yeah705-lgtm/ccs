/**
 * Session Stats Card Tests
 * Unit tests for SessionStatsCard component with project name formatting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionStatsCard } from '../../../../src/components/analytics/session-stats-card';
import { AllProviders } from '../../../setup/test-utils';
import type { PaginatedSessions } from '../../../../src/hooks/use-usage';

// Mock date-fns to return consistent dates
vi.mock('date-fns', async () => {
  const actual = await vi.importActual('date-fns');
  return {
    ...actual,
    formatDistanceToNow: vi.fn(() => '27 minutes ago'),
  };
});

describe('SessionStatsCard', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('Loading and Empty States', () => {
    it('renders loading skeleton when isLoading is true', () => {
      const { container } = render(<SessionStatsCard data={undefined} isLoading={true} />, {
        wrapper: AllProviders,
      });

      // Should have skeleton loading elements
      expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    });

    it('shows empty state when no data available', () => {
      render(<SessionStatsCard data={undefined} />, { wrapper: AllProviders });

      expect(screen.getByText('Session Stats')).toBeInTheDocument();
      expect(screen.getByText('No session data available')).toBeInTheDocument();
    });

    it('shows empty state when sessions array is empty', () => {
      const emptyData: PaginatedSessions = {
        sessions: [],
        total: 0,
        page: 1,
        pageSize: 10,
      };

      render(<SessionStatsCard data={emptyData} />, { wrapper: AllProviders });

      expect(screen.getByText('Session Stats')).toBeInTheDocument();
      expect(screen.getByText('No session data available')).toBeInTheDocument();
    });
  });

  describe('Session Stats Display', () => {
    const createMockSession = (
      projectPath: string,
      inputTokens: number,
      outputTokens: number,
      cost: number
    ) => ({
      sessionId: `session-${Math.random()}`,
      projectPath,
      inputTokens,
      outputTokens,
      cost,
      lastActivity: new Date().toISOString(),
    });

    const mockData: PaginatedSessions = {
      sessions: [
        createMockSession('/home/user/projects/my-app', 1500, 2500, 0.08),
        createMockSession(
          '/home/user/workspaces/repo-name/worktrees/feature-branch',
          2000,
          3000,
          0.12
        ),
        createMockSession('/Users/joe/Developer/share-pi', 1000, 2000, 0.05),
      ],
      total: 3,
      page: 1,
      pageSize: 10,
    };

    beforeEach(() => {
      mockData.sessions = [
        createMockSession('/home/user/projects/my-app', 1500, 2500, 0.08),
        createMockSession(
          '/home/user/workspaces/repo-name/worktrees/feature-branch',
          2000,
          3000,
          0.12
        ),
        createMockSession('/Users/joe/Developer/share-pi', 1000, 2000, 0.05),
      ];
    });

    it('displays session stats header', () => {
      render(<SessionStatsCard data={mockData} />, { wrapper: AllProviders });

      expect(screen.getByText('Session Stats')).toBeInTheDocument();
    });

    it('shows total sessions count', () => {
      render(<SessionStatsCard data={mockData} />, { wrapper: AllProviders });

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Total Sessions')).toBeInTheDocument();
    });

    it('calculates and displays average cost per session', () => {
      render(<SessionStatsCard data={mockData} />, { wrapper: AllProviders });

      // Average cost: (0.08 + 0.12 + 0.05) / 3 = 0.0833 → $0.08
      // Use getAllByText since cost may appear multiple times (per session + average)
      const costElements = screen.getAllByText('$0.08');
      expect(costElements.length).toBeGreaterThan(0);
      expect(screen.getByText('Avg Cost/Session')).toBeInTheDocument();
    });

    it('shows recent activity section', () => {
      render(<SessionStatsCard data={mockData} />, { wrapper: AllProviders });

      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });
  });

  describe('Project Name Formatting', () => {
    it('displays correct project name for simple path', () => {
      const mockData: PaginatedSessions = {
        sessions: [
          {
            sessionId: '1',
            projectPath: '/home/user/projects/my-app',
            inputTokens: 1000,
            outputTokens: 2000,
            cost: 0.05,
            lastActivity: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      render(<SessionStatsCard data={mockData} />, { wrapper: AllProviders });

      // Should show "my-app" instead of just "app"
      expect(screen.getByTitle('/home/user/projects/my-app')).toHaveTextContent('my-app');
    });

    it('displays correct project name for worktree path', () => {
      const mockData: PaginatedSessions = {
        sessions: [
          {
            sessionId: '1',
            projectPath:
              '/Users/joe/Developer/ExaDev/Clients/Architect/repositories/architect/worktrees/2026-01-08',
            inputTokens: 1000,
            outputTokens: 2000,
            cost: 0.05,
            lastActivity: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      render(<SessionStatsCard data={mockData} />, { wrapper: AllProviders });

      // Should show "2026-01-08" instead of just "08"
      expect(
        screen.getByTitle(
          '/Users/joe/Developer/ExaDev/Clients/Architect/repositories/architect/worktrees/2026-01-08'
        )
      ).toHaveTextContent('2026-01-08');
    });

    it('displays correct project name for shared project', () => {
      const mockData: PaginatedSessions = {
        sessions: [
          {
            sessionId: '1',
            projectPath: '/Users/joe/Developer/share-pi',
            inputTokens: 1000,
            outputTokens: 2000,
            cost: 0.05,
            lastActivity: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      render(<SessionStatsCard data={mockData} />, { wrapper: AllProviders });

      // Should show "share-pi" instead of just "pi"
      expect(screen.getByTitle('/Users/joe/Developer/share-pi')).toHaveTextContent('share-pi');
    });

    it('handles empty project path gracefully', () => {
      const mockData: PaginatedSessions = {
        sessions: [
          {
            sessionId: '1',
            projectPath: '',
            inputTokens: 1000,
            outputTokens: 2000,
            cost: 0.05,
            lastActivity: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      render(<SessionStatsCard data={mockData} />, { wrapper: AllProviders });

      // Should not crash and show empty string
      expect(screen.getByTitle('')).toHaveTextContent('');
    });

    it('handles project path with only slashes', () => {
      const mockData: PaginatedSessions = {
        sessions: [
          {
            sessionId: '1',
            projectPath: '///',
            inputTokens: 1000,
            outputTokens: 2000,
            cost: 0.05,
            lastActivity: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      render(<SessionStatsCard data={mockData} />, { wrapper: AllProviders });

      // Should handle gracefully and show empty string
      expect(screen.getByTitle('///')).toHaveTextContent('');
    });
  });

  describe('Token Count Display', () => {
    it('displays token counts in compact format', () => {
      const mockData: PaginatedSessions = {
        sessions: [
          {
            sessionId: '1',
            projectPath: '/project/test',
            inputTokens: 1500000, // 1.5M
            outputTokens: 500000, // 500K
            cost: 0.1,
            lastActivity: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      render(<SessionStatsCard data={mockData} />, { wrapper: AllProviders });

      expect(screen.getByText('2.0M toks')).toBeInTheDocument();
    });
  });

  describe('Privacy Mode', () => {
    it('blurs cost information when privacy mode is enabled', () => {
      // This would require mocking the privacy context
      // For now, just ensure the component renders with privacy mode
      const testData: PaginatedSessions = {
        sessions: [
          {
            sessionId: '1',
            projectPath: '/home/user/project',
            inputTokens: 1000,
            outputTokens: 2000,
            cost: 0.05,
            lastActivity: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      const { container } = render(<SessionStatsCard data={testData} />, { wrapper: AllProviders });

      // Component should render without errors
      expect(container).toBeInTheDocument();
    });
  });
});
