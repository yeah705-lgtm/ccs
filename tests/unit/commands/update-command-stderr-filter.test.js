/**
 * Unit Tests for Update Command stderr filtering on Windows
 *
 * Tests the npm cleanup warning filter logic that hides cosmetic EPERM
 * warnings on Windows during `ccs update`. These warnings occur when
 * npm fails to unlink native module prebuilds (bcrypt.node) due to
 * antivirus/indexing file locking.
 *
 * @see https://github.com/kaitranntt/ccs/issues/405
 */

const assert = require('assert');

/**
 * Simulates the line-buffered stderr filtering logic from update-command.ts
 * This is extracted for testability since mocking spawn is complex.
 */
function createStderrFilter() {
  let buffer = '';
  const output = [];

  return {
    /**
     * Process a chunk of stderr data (simulates 'data' event)
     */
    processChunk(chunk) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!/npm warn cleanup/i.test(line)) {
          output.push(line);
        }
      }
    },

    /**
     * Flush remaining buffer (simulates 'close' event)
     */
    flush() {
      if (buffer && !/npm warn cleanup/i.test(buffer)) {
        output.push(buffer);
      }
      buffer = '';
    },

    /**
     * Get filtered output lines
     */
    getOutput() {
      return output;
    },

    /**
     * Get remaining buffer (for testing)
     */
    getBuffer() {
      return buffer;
    },
  };
}

describe('Update Command stderr filter', function () {
  describe('npm cleanup warning filtering', function () {
    it('filters single npm warn cleanup line', function () {
      const filter = createStderrFilter();
      filter.processChunk('npm warn cleanup Failed to remove some directories\n');
      filter.flush();

      assert.deepStrictEqual(filter.getOutput(), []);
    });

    it('filters multiple npm warn cleanup lines', function () {
      const filter = createStderrFilter();
      filter.processChunk(
        "npm warn cleanup   'C:\\\\Users\\\\...\\\\node_modules\\\\@kaitranntt\\\\.ccs-VzVYv4mp',\n" +
          "npm warn cleanup   [Error: EPERM: operation not permitted, unlink '...\\\\bcrypt.node']\n" +
          'npm warn cleanup   errno: -4048,\n' +
          "npm warn cleanup   code: 'EPERM',\n" +
          "npm warn cleanup   syscall: 'unlink',\n"
      );
      filter.flush();

      assert.deepStrictEqual(filter.getOutput(), []);
    });

    it('preserves non-cleanup npm warnings', function () {
      const filter = createStderrFilter();
      filter.processChunk('npm warn deprecated lodash@1.0.0: Use lodash@4.x instead\n');
      filter.flush();

      assert.deepStrictEqual(filter.getOutput(), [
        'npm warn deprecated lodash@1.0.0: Use lodash@4.x instead',
      ]);
    });

    it('preserves npm errors', function () {
      const filter = createStderrFilter();
      filter.processChunk('npm ERR! code ENOTFOUND\n');
      filter.processChunk('npm ERR! network request failed\n');
      filter.flush();

      assert.deepStrictEqual(filter.getOutput(), [
        'npm ERR! code ENOTFOUND',
        'npm ERR! network request failed',
      ]);
    });

    it('filters cleanup but preserves other warnings in mixed output', function () {
      const filter = createStderrFilter();
      filter.processChunk(
        'npm warn deprecated chalk@4.0.0: Deprecated\n' +
          'npm warn cleanup Failed to remove...\n' +
          'npm warn peer react@17: Use react@18\n' +
          'npm warn cleanup   errno: -4048,\n'
      );
      filter.flush();

      assert.deepStrictEqual(filter.getOutput(), [
        'npm warn deprecated chalk@4.0.0: Deprecated',
        'npm warn peer react@17: Use react@18',
      ]);
    });

    it('is case-insensitive for npm warn cleanup', function () {
      const filter = createStderrFilter();
      filter.processChunk('NPM WARN CLEANUP something\n');
      filter.processChunk('Npm Warn Cleanup another\n');
      filter.flush();

      assert.deepStrictEqual(filter.getOutput(), []);
    });
  });

  describe('chunk boundary handling', function () {
    it('handles warning split across chunks', function () {
      const filter = createStderrFilter();
      // Simulate "npm warn cleanup" split across two chunks
      filter.processChunk('npm war');
      filter.processChunk('n cleanup Failed to remove\n');
      filter.flush();

      // Should still filter - line-buffering catches this
      assert.deepStrictEqual(filter.getOutput(), []);
    });

    it('handles multiple lines split across chunks', function () {
      const filter = createStderrFilter();
      filter.processChunk('npm warn deprecated lodash\n');
      filter.processChunk('npm warn cleanup ');
      filter.processChunk('EPERM error\n');
      filter.processChunk('npm ERR! fatal\n');
      filter.flush();

      assert.deepStrictEqual(filter.getOutput(), ['npm warn deprecated lodash', 'npm ERR! fatal']);
    });

    it('buffers incomplete line until newline', function () {
      const filter = createStderrFilter();
      filter.processChunk('incomplete line without newline');

      // Nothing output yet - still buffered
      assert.deepStrictEqual(filter.getOutput(), []);
      assert.strictEqual(filter.getBuffer(), 'incomplete line without newline');

      // Complete the line
      filter.processChunk(' - now complete\n');
      assert.deepStrictEqual(filter.getOutput(), [
        'incomplete line without newline - now complete',
      ]);
    });

    it('flushes remaining buffer on close', function () {
      const filter = createStderrFilter();
      filter.processChunk('final line no newline');
      filter.flush();

      assert.deepStrictEqual(filter.getOutput(), ['final line no newline']);
    });

    it('does not flush cleanup warning on close', function () {
      const filter = createStderrFilter();
      filter.processChunk('npm warn cleanup no newline');
      filter.flush();

      assert.deepStrictEqual(filter.getOutput(), []);
    });
  });

  describe('edge cases', function () {
    it('handles empty input', function () {
      const filter = createStderrFilter();
      filter.processChunk('');
      filter.flush();

      assert.deepStrictEqual(filter.getOutput(), []);
    });

    it('handles only newlines', function () {
      const filter = createStderrFilter();
      filter.processChunk('\n\n\n');
      filter.flush();

      assert.deepStrictEqual(filter.getOutput(), ['', '', '']);
    });

    it('handles Windows CRLF line endings', function () {
      const filter = createStderrFilter();
      filter.processChunk('npm warn cleanup EPERM\r\nnpm ERR! error\r\n');
      filter.flush();

      // Note: \r remains but line is still filtered by pattern
      // The ERR line has \r at end but that's okay
      const output = filter.getOutput();
      assert.strictEqual(output.length, 1);
      assert.ok(output[0].includes('npm ERR! error'));
    });
  });
});
