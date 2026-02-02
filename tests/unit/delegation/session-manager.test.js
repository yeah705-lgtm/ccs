const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SessionManager } = require('../../../dist/delegation/session-manager');

describe('SessionManager', () => {
  const testSessionsPath = path.join(os.homedir(), '.ccs', 'delegation-sessions.json');

  function cleanupTestSessions() {
    if (fs.existsSync(testSessionsPath)) {
      fs.unlinkSync(testSessionsPath);
    }
  }

  beforeEach(() => {
    cleanupTestSessions();
  });

  afterAll(() => {
    cleanupTestSessions();
  });

  describe('Store and retrieve', () => {
    it('stores new session', () => {
      const mgr = new SessionManager();
      mgr.storeSession('glm', {
        sessionId: 'test123',
        totalCost: 0.0025,
        cwd: '/home/test',
      });

      const session = mgr.getLastSession('glm');
      assert.ok(session);
      assert.strictEqual(session.sessionId, 'test123');
      assert.strictEqual(session.totalCost, 0.0025);
      assert.strictEqual(session.turns, 1);
    });

    it('updates existing session', () => {
      const mgr = new SessionManager();

      mgr.storeSession('glm', {
        sessionId: 'test456',
        totalCost: 0.001,
        cwd: '/home/test',
      });

      mgr.updateSession('glm', 'test456', {
        totalCost: 0.002,
      });

      const session = mgr.getLastSession('glm');
      assert.strictEqual(session.totalCost, 0.003);
      assert.strictEqual(session.turns, 2);
    });

    it('returns null for non-existent profile', () => {
      const mgr = new SessionManager();
      const session = mgr.getLastSession('nonexistent');
      assert.strictEqual(session, null);
    });
  });

  describe('Multiple profiles', () => {
    it('manages multiple profiles separately', () => {
      const mgr = new SessionManager();

      mgr.storeSession('glm', {
        sessionId: 'glm123',
        totalCost: 0.001,
        cwd: '/home/test',
      });

      mgr.storeSession('kimi', {
        sessionId: 'kimi123',
        totalCost: 0.002,
        cwd: '/home/test',
      });

      const glmSession = mgr.getLastSession('glm');
      const kimiSession = mgr.getLastSession('kimi');

      assert.strictEqual(glmSession.sessionId, 'glm123');
      assert.strictEqual(kimiSession.sessionId, 'kimi123');
    });
  });

  describe('Clear profile', () => {
    it('clears profile sessions', () => {
      const mgr = new SessionManager();

      mgr.storeSession('glm', {
        sessionId: 'test789',
        totalCost: 0.001,
        cwd: '/home/test',
      });

      mgr.clearProfile('glm');

      const session = mgr.getLastSession('glm');
      assert.strictEqual(session, null);
    });
  });

  describe('Cleanup expired sessions', () => {
    it('removes expired sessions', () => {
      const mgr = new SessionManager();

      const sessions = {};
      const oldTime = Date.now() - 31 * 24 * 60 * 60 * 1000;
      sessions['glm:latest'] = {
        sessionId: 'old123',
        profile: 'glm',
        startTime: oldTime,
        lastTurnTime: oldTime,
        totalCost: 0.001,
        turns: 1,
        cwd: '/home/test',
      };

      const dir = path.dirname(mgr.sessionsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(mgr.sessionsPath, JSON.stringify(sessions));

      mgr.cleanupExpired();

      const session = mgr.getLastSession('glm');
      assert.strictEqual(session, null);
    });

    it('keeps recent sessions during cleanup', () => {
      const mgr = new SessionManager();

      mgr.storeSession('glm', {
        sessionId: 'recent123',
        totalCost: 0.001,
        cwd: '/home/test',
      });

      mgr.cleanupExpired();

      const session = mgr.getLastSession('glm');
      assert.ok(session);
      assert.strictEqual(session.sessionId, 'recent123');
    });
  });
});
